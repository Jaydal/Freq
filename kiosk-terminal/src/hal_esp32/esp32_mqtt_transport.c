#include "../net/mqtt_transport.h"
#include <string.h>

#include "mqtt_client.h"
#include "esp_crt_bundle.h"
#include "esp_log.h"
#include "esp_event.h"
#include "esp_netif.h"

/* ESP32-S3 MQTT transport: esp-mqtt. Replaces the libmosquitto-based
 * simulator implementation (src/hal_sim/sim_mqtt_transport.c).
 *
 * esp-mqtt runs its own FreeRTOS task internally, so mqtt_transport_poll()
 * is a no-op.  The message callback fires from the esp-mqtt task context;
 * for this project the callback just queues data into the shared model,
 * which is protected at a higher layer. */

static const char *TAG = "mqtt";

static esp_mqtt_client_handle_t s_client    = NULL;
static mqtt_message_cb_t        s_cb        = NULL;
static void                    *s_user_data = NULL;
static char                     s_topic[128] = "";
static bool                     s_connected  = false;
static bool                     s_mqtt_started = false;

/* ── Event handler ───────────────────────────────────────────────────── */

static void ip_event_handler(void *arg, esp_event_base_t event_base,
                             int32_t event_id, void *event_data) {
  (void)arg;
  (void)event_base;
  (void)event_data;
  if (event_id == IP_EVENT_STA_GOT_IP) {
    if (s_client && !s_mqtt_started) {
      ESP_LOGI(TAG, "Network is up, starting MQTT client...");
      s_mqtt_started = true;
      esp_mqtt_client_start(s_client);
    }
  }
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                               int32_t event_id, void *event_data) {
  (void)handler_args;
  (void)base;
  esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;

  switch (event_id) {

    case MQTT_EVENT_CONNECTED:
      ESP_LOGI(TAG, "connected");
      s_connected = true;
      if (s_topic[0]) {
        esp_mqtt_client_subscribe(s_client, s_topic, 0);
      }
      break;

    case MQTT_EVENT_DISCONNECTED:
      ESP_LOGI(TAG, "disconnected");
      s_connected = false;
      break;

    case MQTT_EVENT_DATA:
      /* If the payload was fragmented across multiple DATA events we
       * would need to accumulate it.  For the payloads this project
       * handles, the full message fits in a single event.  Log a
       * warning and skip if that assumption doesn't hold. */
      if (event->data_len < event->total_data_len) {
        ESP_LOGW(TAG, "chunked payload (%d/%d) — skipped",
                 event->data_len, event->total_data_len);
        break;
      }

      if (s_cb && event->data && event->topic) {
        /* event->topic is NOT NUL-terminated; build a temporary copy. */
        char topic_buf[256];
        int tlen = event->topic_len;
        if (tlen >= (int)sizeof(topic_buf)) tlen = (int)sizeof(topic_buf) - 1;
        memcpy(topic_buf, event->topic, tlen);
        topic_buf[tlen] = '\0';

        s_cb(topic_buf, event->data, (size_t)event->data_len, s_user_data);
      }
      break;

    case MQTT_EVENT_ERROR:
      ESP_LOGE(TAG, "transport error");
      break;

    default:
      break;
  }
}

/* ── Public interface ────────────────────────────────────────────────── */

bool mqtt_transport_start(const mqtt_config_t *cfg, mqtt_message_cb_t cb,
                          void *user_data) {
  if (!cfg || !cfg->broker || !cfg->broker[0]) return false;

  s_cb        = cb;
  s_user_data = user_data;

  /* Use a static buffer to ensure the pointer remains valid for the life 
   * of the MQTT client, bypassing esp-tls buggy URI parsing. */
  static char s_host[128];
  memset(s_host, 0, sizeof(s_host));
  int port = 0;
  esp_mqtt_transport_t transport = MQTT_TRANSPORT_UNKNOWN;
  
  if (strncmp(cfg->broker, "mqtts://", 8) == 0) {
      transport = MQTT_TRANSPORT_OVER_SSL;
      sscanf(cfg->broker + 8, "%127[^:]:%d", s_host, &port);
      if (port == 0) port = 8883;
  } else if (strncmp(cfg->broker, "mqtt://", 7) == 0) {
      transport = MQTT_TRANSPORT_OVER_TCP;
      sscanf(cfg->broker + 7, "%127[^:]:%d", s_host, &port);
      if (port == 0) port = 1883;
  } else {
      transport = MQTT_TRANSPORT_OVER_TCP;
      sscanf(cfg->broker, "%127[^:]:%d", s_host, &port);
      if (port == 0) port = 1883;
  }

  esp_mqtt_client_config_t mqtt_cfg = {
    .broker.address.hostname  = s_host,
    .broker.address.port      = port,
    .broker.address.transport = transport,
    .credentials.username     = cfg->username,
    .credentials.authentication.password = cfg->password,
    .buffer.size              = 8192,
  };

  if (transport == MQTT_TRANSPORT_OVER_SSL) {
    mqtt_cfg.broker.verification.crt_bundle_attach = esp_crt_bundle_attach;
  }

  s_client = esp_mqtt_client_init(&mqtt_cfg);
  if (!s_client) {
    ESP_LOGE(TAG, "esp_mqtt_client_init failed");
    return false;
  }

  esp_mqtt_client_register_event(s_client, ESP_EVENT_ANY_ID,
                                 mqtt_event_handler, NULL);

  /* Instead of starting immediately (which spams esp-tls DNS errors because
   * Wi-Fi hasn't connected yet), we wait for the IP_EVENT_STA_GOT_IP event. */
  s_mqtt_started = false;
  esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, ip_event_handler, NULL);

  /* Check if the network is already up (in case Wi-Fi connected extremely fast
   * before this init was called), otherwise the event handler will catch it. */
  esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
  esp_netif_ip_info_t ip_info;
  if (netif && esp_netif_get_ip_info(netif, &ip_info) == ESP_OK && ip_info.ip.addr != 0) {
      ESP_LOGI(TAG, "Network already up, starting MQTT client...");
      s_mqtt_started = true;
      esp_mqtt_client_start(s_client);
  }

  ESP_LOGI(TAG, "configured → %s (waiting for network)", cfg->broker);
  return true;
}

void mqtt_transport_subscribe(const char *topic) {
  snprintf(s_topic, sizeof(s_topic), "%s", topic);
  if (s_connected && s_client) {
    esp_mqtt_client_subscribe(s_client, s_topic, 0);
  }
}

void mqtt_transport_poll(void) {
  /* No-op on ESP32: esp-mqtt runs its own FreeRTOS task internally. */
}

bool mqtt_transport_connected(void) {
  return s_connected;
}
