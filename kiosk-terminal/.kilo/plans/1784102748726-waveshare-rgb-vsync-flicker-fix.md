# Fix Waveshare 7B flicker / vertical roll on touch (RGB VSYNC desync)

## Context

On the ESP32-S3-Touch-LCD-7B, the Setup screen (and any full-screen redraw on
touch) flickers and "rolls" vertically. Root cause is LVGL rendering the next
frame into a PSRAM framebuffer that the RGB LCD DMA is still scanning, which
saturates the PSRAM bus and makes the panel lose VSYNC/HSYNC.

The current `src/hal_esp32/esp32_display.c` flush path already had a (dead)
VSYNC hook but our first attempt — calling `lv_disp_flush_ready()` from an
`on_vsync` ISR callback without blocking the LVGL task — did **not** fix it
(build verified, but symptom persists on hardware).

### Reference (Waveshare's own working example for this exact board)
`github.com/waveshareteam/ESP32-S3-Touch-LCD-7B` → `examples/ESP-IDF/13_LVGL_TRANSPLANT`:

- `components/rgb_lcd_port/rgb_lcd_port.c` registers the sync callback on
  `.on_bounce_frame_finish` **when `bounce_buffer_size_px > 0`** (our config has
  `bounce_buffer_size_px = LCD_H_RES * 10`), otherwise `.on_vsync`.
- `components/lvgl_port/lvgl_port.c` flush callback **blocks the LVGL task**
  until that event fires:
  ```c
  if (lv_disp_flush_is_last(drv)) {
      esp_lcd_panel_draw_bitmap(panel, x1,y1, x2+1,y2+1, color_map);
      ulTaskNotifyValueClear(NULL, ULONG_MAX);
      ulTaskNotifyTake(pdTRUE, portMAX_DELAY);   // <-- hard block until VSYNC
  }
  lv_disp_flush_ready(drv);
  ```
  and `lvgl_port_notify_rgb_vsync()` does `xTaskNotifyFromISR(lvgl_task_handle, ULONG_MAX, eNoAction, &need_yield)` to unblock it. Their RGB timing
  (hsync 162/152/48, vsync 45/13/3, pclk 30 MHz, 1024x600, 16-bit, num_fbs=2,
  bounce buffer, `psram_trans_align=64`) matches our `lcd_panel_init()` already.

The blocking approach is what actually prevents the tearing. The non-blocking
deferred-flush-ready pattern is insufficient because the LVGL task can still
start the next render immediately after `lv_disp_flush_ready`, racing the
bounce-buffer DMA.

## Goal

Adopt Waveshare's exact flush/VSYNC synchronization: block the LVGL task in
`disp_flush_cb` until the RGB bounce frame finishes, unblock it from the
`on_bounce_frame_finish` ISR callback, and move LVGL's tick to a hardware timer
so blocking the task doesn't starve the clock.

## Changes

### 1. `src/hal_esp32/esp32_display.c` — `disp_flush_cb`
Rewrite to block until bounce-frame finish, then mark flush ready (mirror
Waveshare's 2-buffer full-refresh path):
```c
static void disp_flush_cb(lv_disp_drv_t *drv, const lv_area_t *area,
                          lv_color_t *color_p) {
  esp_lcd_panel_draw_bitmap(s_panel, area->x1, area->y1,
                             area->x2 + 1, area->y2 + 1, color_p);
  /* Block this LVGL task until the RGB bounce frame finishes transmitting
   * (VSYNC). Guarantees LVGL never overwrites the framebuffer the DMA is
   * still scanning — eliminates the vertical-roll flicker. */
  ulTaskNotifyValueClear(NULL, ULONG_MAX);
  ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
  lv_disp_flush_ready(drv);
}
```

### 2. `src/hal_esp32/esp32_display.c` — sync callback
- Delete the current `rgb_flush_ready_cb` (the ISR that calls
  `lv_disp_flush_ready`). It is no longer used.
- Rename `on_vsync_cb` → `lvgl_vsync_notify_cb` (keep semantics: it calls
  `vTaskNotifyGiveFromISR(s_lvgl_task_handle, &need_yield)` and returns
  `need_yield`). This is the unblock half of the sync.

### 3. `src/hal_esp32/esp32_display.c` — `lvgl_display_init`
Register the callback on `.on_bounce_frame_finish` (bounce buffer is present),
not `.on_vsync`:
```c
esp_lcd_rgb_panel_event_callbacks_t rgb_cbs = {
    .on_bounce_frame_finish = lvgl_vsync_notify_cb,
};
ESP_ERROR_CHECK(esp_lcd_rgb_panel_register_event_callbacks(
    s_panel, &rgb_cbs, &s_disp_drv));
```
(Remove the earlier `.on_vsync = rgb_flush_ready_cb` line; the single combined
registration already done in this file stays, just with the corrected event.)

### 4. `src/hal_esp32/esp32_main.c` — LVGL task + tick
- At the **start** of `prv_lvgl_task`, before the loop, call
  `esp32_display_set_lvgl_task(xTaskGetCurrentTaskHandle());`. This guarantees
  `s_lvgl_task_handle` is set before the first flush runs in this task
  (avoids a deadlock race: the task would otherwise block on
  `ulTaskNotifyTake` while the ISR notifies a still-NULL handle).
- Remove `lv_tick_inc(LVGL_HANDLER_PERIOD_MS);` from the loop body.
- Add an `esp_timer` periodic callback (mirror Waveshare's `tick_init()`),
  started once in `app_main` (or init), e.g. every `LVGL_HANDLER_PERIOD_MS`:
  ```c
  static void lvgl_tick_cb(void *arg) { lv_tick_inc(LVGL_HANDLER_PERIOD_MS); }
  // esp_timer_create + esp_timer_start_periodic(..., LVGL_HANDLER_PERIOD_MS * 1000)
  ```
  This keeps LVGL's clock accurate even though the LVGL task now blocks ~1
  frame per flush.

### 5. (Optional, low-risk) `src/hal_esp32/esp32_display.c` — `panel_cfg`
To match the reference exactly, add `.bits_per_pixel = 16` and
`.sram_trans_align = 4` alongside the existing `psram_trans_align = 64`. The
display already works, so this is defensive correctness, not a fix.

## Constraints / boundaries
- Do NOT change the RGB timing, GPIO pins, IO-expander sequence, GT911 config,
  or the Setup-screen layout (the keyboard `LV_OBJ_FLAG_FLOATING` change from
  the prior step stays).
- `full_refresh = 1` stays (matches Waveshare's working config).
- Keep `ui_app_init()` / `esp32_display_set_lvgl_task` API unchanged; only the
  call site moves into the task.

## Risks / failure modes
- **Deadlock if `s_lvgl_task_handle` is NULL at first flush** → mitigated by
  setting the handle at the top of `prv_lvgl_task` (step 4).
- **Deadlock / hang if `on_bounce_frame_finish` never fires** for full-screen
  refreshes on this IDF (5.1.2). Waveshare uses this exact event with
  bounce>0 + full_refresh, so it should fire every frame. Fallback: if the
  screen hangs (task blocked forever), move the callback to `.on_vsync`
  instead. Note this in the commit/PR.
- Blocking the LVGL task ~16 ms/frame gates all LVGL timers (MQTT poll, 1 s
  GT911 log, 4 s success auto-dismiss) to ~60 Hz — acceptable; they were
  already running on the LVGL task.

## Validation
1. `pio run -e waveshare-7b` compiles cleanly (RAM/Flash within limits).
2. PC simulator still builds (`cmake --build build`) — `esp32_display.c` is
   ESP32-only, but confirm no shared-file regression.
3. Flash (`pio run -e waveshare-7b -t upload`) and verify on hardware:
   - Setup screen does not roll/flicker; tapping fields + on-screen keyboard is
     stable.
   - Touch generally responsive; no tearing during queue-board refresh.
   - If the screen hangs/freezes on first paint → switch sync event to
     `.on_vsync` (fallback above) and rebuild.

## Open question (not blocking)
Whether `.bits_per_pixel`/`sram_trans_align` (step 5) are needed — include
them to match the reference; they are safe regardless.
