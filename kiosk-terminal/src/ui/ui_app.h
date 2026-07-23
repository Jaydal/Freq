#pragma once

#include <stdbool.h>

/* Single portable entry point — identical on real ESP32-S3 hardware.
 * Call once after the display/input HAL is initialized. When use_mock is
 * false, the live provider (MQTT board + REST actions) is used, configured
 * from the saved kiosk_config; */
void ui_app_init(void);

/* Call this when RFID is scanned in the background (e.g. from MQTT or UART) */
void ui_app_handle_scan(const char *rfid);

/* Force a complete re-render of the current step (e.g. after theme change) */
void ui_app_force_render(void);
