#pragma once

/* Registers the LVGL input device driver, using SDL mouse clicks as a
 * stand-in for touch. Simulator-only — replaced by a real touch controller
 * driver in the hardware phase. */
void sim_input_init(void);
