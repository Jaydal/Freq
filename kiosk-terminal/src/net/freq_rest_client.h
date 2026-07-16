#pragma once

#include "../data/kiosk_model.h"
#include <stdbool.h>
#include <stddef.h>

/* REST client for the Freq web backend (the web/src/app/api routes).
 *
 * Uses the portable http_transport interface, so it works in the simulator
 * (libcurl) and on the ESP32-S3 (esp_http_client) without changes.
 *
 * Endpoint coverage vs. the live backend:
 *   GET   /api/controller/member/{rfid}   -> freq_rest_lookup_member  (needs API key)
 *   POST  /api/queue                       -> freq_rest_join_queue
 *   GET   /api/queue?memberId={uuid}       -> freq_rest_get_member_queue
 *
 * The live board (court cards + now-serving + queue) does NOT come through
 * this REST client — the backend publishes it to MQTT (topic `freq/board`,
 * see board_parser.h), which the kiosk subscribes to. This REST client covers
 * the request/response actions (RFID lookup + booking); MQTT covers the board.
 */

typedef struct {
  bool ok;            /* true if the call completed with a 2xx status      */
  long http_status;   /* raw HTTP status; 0 = transport/connection failure */
  char error[128];    /* human-readable message when ok == false           */
} freq_rest_result_t;

/* Call once at startup. base_url like "http://192.168.1.50:3000" (no trailing
 * slash). api_key may be NULL if the controller endpoints are open (dev). */
void freq_rest_init(const char *base_url, const char *api_key);

/* POST /api/display/publish-all to wake Vercel */
void freq_rest_wake_server(void);

/* GET /api/controller/member/{rfid}. Fills out->{member_id,first_name,
 * last_name,balance}; out->id (UUID) is left empty pending backend gap #1. */
freq_rest_result_t freq_rest_lookup_member(const char *rfid, kiosk_member_t *out);

typedef struct {
  char status[16];                         /* "completed" | "waiting" | "offered" */
  char entry_id[KIOSK_MAX_ID_LEN];
  char court_name[KIOSK_MAX_NAME_LEN];     /* set when status == "completed"      */
  int32_t position;                        /* set when status == "waiting"        */
  char estimated_wait[16];                 /* set when status == "waiting"        */
} freq_join_response_t;

/* POST /api/queue. player_uuids has player_count entries (1..4).
 * court_uuid and match_title may be NULL. start_iso is an ISO-8601 string. */
freq_rest_result_t freq_rest_join_queue(const char *member_uuid, const char *start_iso,
                                        int32_t duration_min, int32_t party_size,
                                        const char *const *player_uuids, size_t player_count,
                                        const char *court_uuid, const char *match_title,
                                        freq_join_response_t *out);

/* DELETE /api/queue/{id}. */
freq_rest_result_t freq_rest_cancel_queue(const char *entry_id);
