#pragma once

/* Registers the LVGL display driver backed by lv_drivers' SDL window.
 * Simulator-only — replaced by a real LCD panel driver in the hardware phase. */
void sim_display_init(void);
