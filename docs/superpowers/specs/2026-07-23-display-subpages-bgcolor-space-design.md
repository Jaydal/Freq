# Display Sub-Pages, BG Color & Space Width — Design Spec

## Problem

The current display system has several limitations:

1. **Paginate effect is server-side only** — it expands text into separate pages (with hardcoded 1.5s duration) before sending to the display. Lines cannot independently cycle content at their own pace.
2. **No background color** — text is drawn directly on the LED without any background fill, making it hard to read against other zone content.
3. **Word spacing is too wide** — the space between words on the LED occupies 3+ pixels (at scale 2) when it should be 2.
4. **No publish after save** — saving the display sequence editor does not trigger a payload refresh.

## Sub-Pages (replaces `paginate`)

### Type Changes (`web/src/components/display/zone-types.ts`)

```typescript
interface SubPage {
  text: string;
  effect: 'SCROLL' | 'STATIC' | 'BLINK';
  color: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  scrollSpeed?: number;
  durationMs: number;
}

interface DisplayLine {
  subpages: SubPage[];        // replaces text/color/effect at line level
  marginTop?: number;
  marginBottom?: number;
}
```

### Backward Compatibility

**Editor side**: When deserializing a saved sequence:
- If a line has `text` (string) instead of `subpages` (array) → convert to `[{ text, color, effect, durationMs: page.durationSeconds * 1000 }]`
- If a line has `subpages` → use as-is

**Server side** (`sports-caster.ts` `generatePayload()`): Reads `displaySequence` from settings. After deserialization, convert any line without `subpages` to a single sub-page before generating the MQTT payload.

**Firmware side** (`MqttDisplayClient.cpp` parser): Parses the JSON payload. Checks for `subpages` array per line. If absent, treats the legacy `text`/`color`/`effect` fields as a single sub-page internally.

### Behavior

- Each line independently cycles through its `subpages[]` at its own pace.
- Each sub-page has its own `durationMs` controlling how long it displays before the line advances to the next sub-page.
- When reaching the end of `subpages[]`, the line wraps to index 0.
- The **page-level timer** (`durationSeconds` / `durationMs` on the page) still controls when the entire page advances to the next page in the playlist. When the page advances, all sub-page indices reset to 0.
- Sub-page indices are per-zone-per-line (stored as `uint8_t subpageIdx[3][2]` in firmware).

### Server-Side (`sports-caster.ts`)

- Remove the `paginate` effect expansion (no more `paginateWords()` splitting).
- `generatePayload()` passes through `subpages[]` directly in the line payload.
- Each sub-page gets `durationMs` (converted from the editor's ms value).

### Firmware (`MqttDisplayClient.cpp`)

**New struct in header:**
```cpp
struct SubPage {
  std::string text;
  std::string color;
  std::string effect;
  std::string align;
  float scrollSpeed;
  uint8_t bgR, bgG, bgB;   // background color (0 = transparent)
  uint16_t durationMs;
};
```

**`ZoneLine` struct updated:**
```cpp
struct ZoneLine {
  std::vector<SubPage> subpages;   // replaces text/color/effect/align/scrollSpeed
  uint8_t marginTop;
  uint8_t marginBottom;
};
```

**`DisplayPage` struct** — `durationSeconds` → add `durationMs` field (if present, takes priority; else `durationSeconds * 1000`).

**`_subpageIdx[3][2]`** — per-zone, per-line sub-page index, initialized to 0 on each `applyCurrentPage()` call.

**`update()` loop** — after page-level timer check, for each zone/line:
```cpp
if (line.subpages.size() > 1) {
  auto& sp = line.subpages[subIdx];
  if (now - _lastSubChange[zi][li] >= sp.durationMs) {
    _lastSubChange[zi][li] = now;
    subIdx = (subIdx + 1) % line.subpages.size();
  }
}
```

**`applyCurrentPage()`** — transfers sub-page data from `DisplayPage::ZoneLine::subpages[]` into `ZoneRenderInfo::lines[]`. The current sub-page's text/color/effect/etc is written to the render line struct.

### Firmware (`Hub75Driver.cpp`)

**`ZoneRenderInfo::LineRenderInfo`** — same fields but populated from the active sub-page.

**`redraw()`** — no change needed at the draw level; it reads `line.text`, `line.color`, etc. which are already populated by `applyCurrentPage()`.

### Editor (`ZonePanel.tsx`)

Each line's text input is replaced with a sub-page list editor:
- Sub-page list with add/remove/reorder
- Each sub-page shows: text input, effect dropdown, color picker, bgColor picker, align buttons, scrollSpeed, durationMs input
- The old `paginate` option removed from effect dropdown

### Duration: ms everywhere

- `DisplayPage.durationSeconds` gets an additional field `durationMs` (uint16). If present, the firmware uses it as the page timer. The editor should default to seconds for page-level, ms for sub-page-level.
- JSON serialization: `durationMs` integer in milliseconds. `durationSeconds` remains for backward compatibility.

## Background Color

### Where it renders

`SubPage.bgColor?: string` — hex color (e.g. `"#FF0000"`). When present, the firmware fills a rectangle **behind the rendered text characters** before drawing the glyphs.

- The rectangle width = `textWidth5x7Scaled(text, scale)` (exact text width, not zone width)
- The rectangle height = `CHAR_H * scale` (7 * scale pixels)
- The rectangle position = same X,Y where text begins (accounts for alignment and scroll offset)
- For SCROLL text, the background scrolls with the text (same `scrollX` offset applied)

### Firmware (`Hub75Driver.cpp` `redraw()`)

Before `drawText5x7Scaled()`:
```cpp
if (line.bgColor != Color::TRANSPARENT) {
  int tw = textWidth5x7Scaled(display.c_str(), scale);
  for (int row = 0; row < CHAR_H * scale; row++) {
    for (int col = 0; col < tw; col++) {
      drawPixelMapped(x + col, lineY[li] + row, line.bgColor);
    }
  }
}
```

This is a simple rectangle fill (no rounded corners, no padding). The background is clamped to the zone bounds.

### Server/Editor

- `SubPage.bgColor` passed through as-is from editor to firmware.
- Editor: color picker for bgColor next to the text color picker. Default: none (empty/unset = transparent).

### Web Preview

`P10Display.tsx` `textToDots()` gets an additional `bgColor` param. Before emitting text dots, emit background dots for the text rectangle area. `P10Canvas.tsx` renders similarly.

### Color Transport

In MQTT JSON payload, `bgColor` is sent as a hex string like `"#FF0000"`. Firmware parses it with the same `parseHexColor()` helper used for foreground `color`.

## Space Width (2 Dots)

### Current behavior

In `drawText5x7Scaled()`, the space character advances by `SPACING * scale` (1px at scale 1, 2px at scale 2). Combined with the standard `SPACING` after the previous character, the total gap between words is 2 pixels at scale 1, 4 pixels at scale 2.

### Fix

In `drawText5x7Scaled()` (line 449), change space cursor advancement from `SPACING * scale` to `0`.

In `textWidth5x7Scaled()` (lines 409-410), skip the `SPACING * scale` pre-gap for space characters (so text width calculation matches rendered width).

Same changes in `P10Display.tsx` `textToDots()` and `P10Canvas.tsx` `textWidthPx()`.

After fix:
- Scale 1: gap between words = 1 pixel (just the standard inter-character SPACING)
- Scale 2: gap between words = 2 pixels (SPACING * 2)
- The visual space reduces from 4 to 2 pixels at scale 2 — matching the "2 dots" requirement.

## Publish After Save

In `DisplaySequenceEditorV2.tsx` `handleSave()`, after the `fetch('/api/settings', ...)` succeeds, call:
```typescript
await fetch('/api/display/publish-all', { method: 'POST' });
```

This immediately publishes the updated sequence to all courts, so the LED display reflects the change without waiting for the next 5-second processor cycle.

## Line 2 Scale Bug Fix (separate fix)

In `Hub75Driver.cpp` `redraw()` lines 343-344, the blanket `scales[li] = 1` for 2-line zones is replaced with per-line scale selection:
- If the line has SCROLL effect, scale = 2 (so scrolling text has more room)
- If text fits at 2x within the zone width, scale = 2
- Otherwise, scale = 1

This is the same logic used for 1-line zones applied per-line.
