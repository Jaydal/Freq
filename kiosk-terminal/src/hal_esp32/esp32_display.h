#pragma once

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

/* Initializes the RGB LCD panel, the IO expander (for backlight / touch reset),
 * and registers the LVGL display + touch input drivers.
 * Call after lv_init(). */
void esp32_display_init(void);

/* Passes the LVGL task handle to the display driver so it can notify the task
 * when a VSYNC / DMA flush finishes. Must be called after task creation. */
void esp32_display_set_lvgl_task(TaskHandle_t handle);
