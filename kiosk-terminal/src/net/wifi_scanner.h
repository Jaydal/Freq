#pragma once

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char ssid[33];
    int8_t rssi;
} kiosk_wifi_ap_t;

typedef void (*kiosk_wifi_scan_cb_t)(kiosk_wifi_ap_t *results, uint16_t count, void *user_data);

/**
 * @brief Starts an asynchronous WiFi scan.
 * The callback will be invoked (possibly from another task/thread) when complete.
 * The `results` array is only valid during the callback.
 */
void kiosk_wifi_scan_start(kiosk_wifi_scan_cb_t cb, void *user_data);

#ifdef __cplusplus
}
#endif
