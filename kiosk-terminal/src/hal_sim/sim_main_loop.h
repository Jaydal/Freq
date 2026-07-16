#pragma once

/* Initializes SDL plus the display/input drivers above (the simulator's
 * whole HAL). On real ESP32-S3 hardware this is replaced by an equivalent
 * hal_esp32_init() — nothing outside hal_sim/ calls SDL directly. */
void sim_hal_init(void);

/* Pumps LVGL's timer handler forever. Never returns. */
void sim_main_loop_run(void);
