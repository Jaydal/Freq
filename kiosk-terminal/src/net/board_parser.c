#include "board_parser.h"
#include "cJSON.h"
#include <string.h>
#include <stdio.h>
#include <sys/time.h>

static void get_str(const cJSON *obj, const char *key, char *out, size_t out_size) {
  const cJSON *item = cJSON_GetObjectItemCaseSensitive(obj, key);
  if (cJSON_IsString(item) && item->valuestring) {
    snprintf(out, out_size, "%s", item->valuestring);
  } else {
    out[0] = '\0';
  }
}

static double get_num(const cJSON *obj, const char *key) {
  const cJSON *item = cJSON_GetObjectItemCaseSensitive(obj, key);
  return cJSON_IsNumber(item) ? item->valuedouble : 0;
}

static bool get_bool(const cJSON *obj, const char *key) {
  const cJSON *item = cJSON_GetObjectItemCaseSensitive(obj, key);
  return cJSON_IsBool(item) ? cJSON_IsTrue(item) : false;
}

bool board_parse(const char *json, size_t len, kiosk_board_t *out) {
  memset(out, 0, sizeof(*out));
  cJSON *root = cJSON_ParseWithLength(json, len);
  if (!root) return false;

  /* config (durations/rates/prep) — from the API, not hardcoded */
  const cJSON *cfg = cJSON_GetObjectItemCaseSensitive(root, "config");
  if (cJSON_IsObject(cfg)) {
    out->config.prep_time_sec = (int32_t)get_num(cfg, "prepTimeSec");
    const cJSON *durs = cJSON_GetObjectItemCaseSensitive(cfg, "durations");
    const cJSON *rates = cJSON_GetObjectItemCaseSensitive(cfg, "rates");
    if (cJSON_IsArray(durs)) {
      const cJSON *d;
      cJSON_ArrayForEach(d, durs) {
        if (out->config.duration_count >= KIOSK_MAX_DURATIONS) break;
        uint8_t i = out->config.duration_count;
        out->config.durations_min[i] = (int32_t)(cJSON_IsNumber(d) ? d->valuedouble : 0);
        const cJSON *r = cJSON_IsArray(rates) ? cJSON_GetArrayItem(rates, i) : NULL;
        out->config.rates[i] = (int32_t)(cJSON_IsNumber(r) ? r->valuedouble : 0);
        out->config.duration_count++;
      }
    }
  }

  /* courts */
  const cJSON *courts = cJSON_GetObjectItemCaseSensitive(root, "courts");
  if (cJSON_IsArray(courts)) {
    const cJSON *c;
    cJSON_ArrayForEach(c, courts) {
      if (out->court_count >= KIOSK_MAX_COURTS) break;
      court_status_t *dst = &out->courts[out->court_count++];
      get_str(c, "id", dst->id, sizeof(dst->id));
      get_str(c, "name", dst->name, sizeof(dst->name));
      dst->active = get_bool(c, "active");
      get_str(c, "matchType", dst->match_type, sizeof(dst->match_type));
      get_str(c, "matchTitle", dst->match_title, sizeof(dst->match_title));
      dst->start_time = (time_t)get_num(c, "startTime");
      dst->duration_min = (int32_t)get_num(c, "durationMin");
      dst->prep_time_sec = (int32_t)get_num(c, "prepTimeSec");

      const cJSON *players = cJSON_GetObjectItemCaseSensitive(c, "players");
      if (cJSON_IsArray(players)) {
        const cJSON *p;
        cJSON_ArrayForEach(p, players) {
          if (dst->player_count >= KIOSK_MAX_PLAYERS) break;
          kiosk_player_name_t *pl = &dst->players[dst->player_count++];
          get_str(p, "firstName", pl->first_name, sizeof(pl->first_name));
          get_str(p, "lastName", pl->last_name, sizeof(pl->last_name));
        }
      }
    }
  }

  /* queue */
  const cJSON *queue = cJSON_GetObjectItemCaseSensitive(root, "queue");
  if (cJSON_IsArray(queue)) {
    const cJSON *q;
    cJSON_ArrayForEach(q, queue) {
      if (out->queue_count >= KIOSK_MAX_QUEUE) break;
      queue_row_t *dst = &out->queue[out->queue_count++];
      get_str(q, "id", dst->id, sizeof(dst->id));
      get_str(q, "memberId", dst->member_id, sizeof(dst->member_id));
      dst->position = (int32_t)get_num(q, "position");
      get_str(q, "firstName", dst->first_name, sizeof(dst->first_name));
      get_str(q, "lastName", dst->last_name, sizeof(dst->last_name));
      get_str(q, "matchType", dst->match_type, sizeof(dst->match_type));
      get_str(q, "matchTitle", dst->match_title, sizeof(dst->match_title));
      get_str(q, "courtName", dst->court_name, sizeof(dst->court_name));
      dst->duration_min = (int32_t)get_num(q, "durationMin");
      get_str(q, "estimatedWait", dst->estimated_wait, sizeof(dst->estimated_wait));
    }
  }

  /* sync system clock with server time to avoid SNTP dependency */
  time_t server_time = (time_t)get_num(root, "serverTime");
  if (server_time > 1700000000) { /* basic sanity check, must be > year 2023 */
    struct timeval tv;
    tv.tv_sec = server_time;
    tv.tv_usec = 0;
    settimeofday(&tv, NULL);
  }

  cJSON_Delete(root);
  return true;
}
