#pragma once

#include "../kiosk_data_provider.h"

/* The real data provider: board comes from MQTT (`freq/board`), actions go
 * through the REST client. Call live_data_provider_start() once (after config
 * is loaded) to connect MQTT + point the REST client at the server, then use
 * kiosk_data_provider_get() as usual.
 *
 * board_broker/board_user/board_pass configure the MQTT connection;
 * server_url/api_key configure the REST client. */
void live_data_provider_start(const char *server_url, const char *api_key,
                              const char *mqtt_broker, const char *mqtt_user,
                              const char *mqtt_pass);

const kiosk_data_provider_t *live_data_provider_get(void);
