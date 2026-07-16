#pragma once

#include <stdbool.h>
#include <stddef.h>

/* Persistent device configuration (WiFi credentials for now).
 *
 * The API is portable; the storage mechanism is platform-specific:
 *   - simulator: a local file (src/hal_sim/sim_config_store.c)
 *   - ESP32-S3:  NVS flash (a future src/hal_esp32/ implementation)
 * so src/ui/ only ever touches this interface, never the backing store. */

#define KIOSK_CONFIG_SSID_LEN 64
#define KIOSK_CONFIG_PASS_LEN 64
#define KIOSK_CONFIG_URL_LEN  128
#define KIOSK_CONFIG_KEY_LEN  128

typedef struct {
  char wifi_ssid[KIOSK_CONFIG_SSID_LEN];
  char wifi_password[KIOSK_CONFIG_PASS_LEN];
  char server_url[KIOSK_CONFIG_URL_LEN];   /* REST base, e.g. http://192.168.1.50:3000 */
  char api_key[KIOSK_CONFIG_KEY_LEN];      /* CONTROLLER_API_KEY for controller endpoints */
  char mqtt_broker[KIOSK_CONFIG_URL_LEN];  /* e.g. host:port or a mqtt(s):// URL */
  char mqtt_user[KIOSK_CONFIG_SSID_LEN];
  char mqtt_password[KIOSK_CONFIG_PASS_LEN];
} kiosk_config_t;

/* True if a config has been saved (i.e. setup was completed at least once). */
bool kiosk_config_exists(void);

/* Loads the saved config into *out. Returns false (and leaves *out zeroed)
 * if none is saved. */
bool kiosk_config_load(kiosk_config_t *out);

/* Persists cfg. Returns false on a storage error. */
bool kiosk_config_save(const kiosk_config_t *cfg);

/* Fills *out with default values for prefilling the setup form on first boot:
 * built-in non-secret defaults (server URL, placeholder SSID) overlaid with a
 * local, git-ignored kiosk_defaults.ini if present (broker, credentials, API
 * key). In the simulator WiFi is unused — the host network is used directly. */
void kiosk_config_defaults(kiosk_config_t *out);
