#include "live_data_provider.h"
#include "../../net/freq_rest_client.h"
#include "../../net/mqtt_transport.h"
#include "../../net/board_parser.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

/* Latest board, updated on each `freq/board` MQTT message. The MQTT client is
 * pumped from the UI thread (mqtt_transport_poll via an LVGL timer in main),
 * so this cache is only ever touched from one thread — no locking needed. */
static kiosk_board_t s_board;
static bool s_have_board = false;
static uint32_t s_board_version = 1;

static void on_board_message(const char *topic, const char *payload, size_t len, void *user_data) {
  (void)topic; (void)user_data;
  kiosk_board_t *parsed = malloc(sizeof(kiosk_board_t));
  if (!parsed) return;
  if (board_parse(payload, len, parsed)) {
    if (!s_have_board || memcmp(&s_board, parsed, sizeof(kiosk_board_t)) != 0) {
      s_board = *parsed;
      s_have_board = true;
      s_board_version++;
    }
  }
  free(parsed);
}

// ── kiosk_data_provider_t implementation ────────────────────────────────────

static void get_board(kiosk_board_t *out) {
  if (s_have_board) *out = s_board;
  else memset(out, 0, sizeof(*out));
}

static void get_court_options(court_option_t *out, uint8_t *count) {
  uint8_t n = 0;
  if (s_have_board) {
    for (uint8_t i = 0; i < s_board.court_count && n < KIOSK_MAX_COURTS; i++) {
      const court_status_t *c = &s_board.courts[i];
      court_option_t *o = &out[n++];
      memset(o, 0, sizeof(*o));
      snprintf(o->id, sizeof(o->id), "%s", c->id);
      snprintf(o->name, sizeof(o->name), "%s", c->name);
      snprintf(o->status, sizeof(o->status), "%s", court_is_active(c) ? "Playing" : "Available");
    }
  }
  *count = n;
}

static void get_products_config(kiosk_products_config_t *out) {
  /* Durations/rates come from the board's config (from the API). Fall back to
   * seed defaults only if the board hasn't been received yet. */
  if (s_have_board && s_board.config.duration_count > 0) {
    *out = s_board.config;
    return;
  }
  memset(out, 0, sizeof(*out));
  const int32_t durations[] = { 30, 60, 90 };
  const int32_t rates[] = { 150, 300, 450 };
  out->duration_count = 3;
  for (uint8_t i = 0; i < 3; i++) { out->durations_min[i] = durations[i]; out->rates[i] = rates[i]; }
  out->prep_time_sec = 300;
}

static bool lookup_member(const char *rfid, kiosk_member_t *out) {
  freq_rest_result_t r = freq_rest_lookup_member(rfid, out);
  return r.ok;
}

static member_state_t check_member_state(const char *member_id,
                                         kiosk_error_t *out_error) {
  (void)out_error;
  if (!s_have_board) return MEMBER_STATE_NONE;

  for (uint8_t i = 0; i < s_board.queue_count; i++) {
    if (strcmp(s_board.queue[i].member_id, member_id) == 0) {
      return MEMBER_STATE_HAS_WAITING;
    }
  }

  return MEMBER_STATE_NONE;
}

static bool join_queue(const char *member_id, const char *court_id, game_type_t game_type,
                       int32_t duration_min, const char *match_title,
                       booking_result_t *out_result, kiosk_error_t *out_error) {
  const char *players[1] = { member_id };
  int32_t party_size = (game_type == GAME_TYPE_2V2) ? 4 : 2;
  char start_iso[32];
  /* ISO-8601 UTC "now". */
  time_t now = time(NULL);
  struct tm tm_utc;
  gmtime_r(&now, &tm_utc);
  strftime(start_iso, sizeof(start_iso), "%Y-%m-%dT%H:%M:%SZ", &tm_utc);

  freq_join_response_t resp;
  freq_rest_result_t r = freq_rest_join_queue(
      member_id, start_iso, duration_min, party_size,
      players, 1,
      (court_id && court_id[0]) ? court_id : NULL,
      (match_title && match_title[0]) ? match_title : NULL,
      &resp);

  if (!r.ok) {
    snprintf(out_error->title, sizeof(out_error->title), "Unable to Join Queue");
    snprintf(out_error->message, sizeof(out_error->message), "%s", r.error);
    return false;
  }

  memset(out_result, 0, sizeof(*out_result));
  out_result->duration_min = duration_min;
  out_result->success = (strcmp(resp.status, "completed") == 0);
  snprintf(out_result->court_name, sizeof(out_result->court_name), "%s", resp.court_name);
  /* Credits/balance aren't returned by the join endpoint; left at 0 for now. */
  return true;
}

static void cancel_waiting(const char *member_id) {
  if (!s_have_board) return;
  for (uint8_t i = 0; i < s_board.queue_count; i++) {
    if (strcmp(s_board.queue[i].member_id, member_id) == 0) {
      freq_rest_cancel_queue(s_board.queue[i].id);
      break;
    }
  }
}
static bool is_ready(void) {
  return s_have_board;
}

static uint32_t get_board_version(void) {
  return s_board_version;
}

static const kiosk_data_provider_t s_live_provider = {
  .get_board = get_board,
  .get_court_options = get_court_options,
  .get_products_config = get_products_config,
  .lookup_member = lookup_member,
  .check_member_state = check_member_state,
  .join_queue = join_queue,
  .cancel_waiting = cancel_waiting,
  .is_ready = is_ready,
  .get_board_version = get_board_version,
};

void live_data_provider_start(const char *server_url, const char *api_key,
                              const char *mqtt_broker, const char *mqtt_user,
                              const char *mqtt_pass) {
  memset(&s_board, 0, sizeof(s_board));
  s_have_board = false;

  freq_rest_init((server_url && server_url[0]) ? server_url : "http://localhost:3000",
                 (api_key && api_key[0]) ? api_key : NULL);

  mqtt_config_t cfg = { mqtt_broker, mqtt_user, mqtt_pass };
  if (mqtt_broker && mqtt_broker[0]) {
    mqtt_transport_start(&cfg, on_board_message, NULL);
    mqtt_transport_subscribe("freq/board");
  }
  
  /* Send a non-blocking ping to the Next.js API to wake it up in case it is sleeping on a serverless platform (Vercel) */
  freq_rest_wake_server();
}

const kiosk_data_provider_t *live_data_provider_get(void) {
  return &s_live_provider;
}
