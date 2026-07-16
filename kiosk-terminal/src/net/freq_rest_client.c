#include "freq_rest_client.h"
#include "http_transport.h"
#include "cJSON.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char s_base_url[128] = "http://localhost:3000";
static char s_api_key[128] = "";

void freq_rest_init(const char *base_url, const char *api_key) {
  if (base_url) snprintf(s_base_url, sizeof(s_base_url), "%s", base_url);
  if (api_key) snprintf(s_api_key, sizeof(s_api_key), "%s", api_key);
  else s_api_key[0] = '\0';
}

static freq_rest_result_t result_ok(long status) {
  freq_rest_result_t r;
  r.ok = true;
  r.http_status = status;
  r.error[0] = '\0';
  return r;
}

static freq_rest_result_t result_err(long status, const char *msg) {
  freq_rest_result_t r;
  r.ok = false;
  r.http_status = status;
  snprintf(r.error, sizeof(r.error), "%s", msg ? msg : "Request failed");
  return r;
}

/* Pulls an "error" string field out of a JSON body, if present, into `out`. */
static void extract_error(const char *body, char *out, size_t out_size) {
  out[0] = '\0';
  if (!body) return;
  while (*body && *body != '{') body++;
  cJSON *json = *body == '{' ? cJSON_Parse(body) : NULL;
  if (!json) return;
  const cJSON *err = cJSON_GetObjectItemCaseSensitive(json, "error");
  if (cJSON_IsString(err) && err->valuestring) {
    snprintf(out, out_size, "%s", err->valuestring);
  }
  cJSON_Delete(json);
}

static bool is_valid_url_path_segment(const char *str) {
  if (!str || str[0] == '\0') return false;
  for (size_t i = 0; str[i] != '\0'; i++) {
    char c = str[i];
    if (!(c >= 'a' && c <= 'z') && !(c >= 'A' && c <= 'Z') &&
        !(c >= '0' && c <= '9') && c != '-') {
      return false;
    }
  }
  return true;
}

static void copy_json_string(const cJSON *obj, const char *key, char *out, size_t out_size) {
  if (out_size > 0) out[0] = '\0';
  const cJSON *item = cJSON_GetObjectItemCaseSensitive(obj, key);
  if (cJSON_IsString(item) && item->valuestring) {
    snprintf(out, out_size, "%s", item->valuestring);
  }
}

freq_rest_result_t freq_rest_lookup_member(const char *rfid, kiosk_member_t *out) {
  memset(out, 0, sizeof(*out));
  if (!is_valid_url_path_segment(rfid)) return result_err(0, "Invalid RFID format");

  char url[256];
  int n = snprintf(url, sizeof(url), "%s/api/controller/member/%s", s_base_url, rfid);
  if (n < 0 || n >= sizeof(url)) return result_err(0, "URL too long");

  http_header_t headers[1];
  size_t header_count = 0;
  if (s_api_key[0]) {
    headers[0].name = "x-api-key";
    headers[0].value = s_api_key;
    header_count = 1;
  }

  http_response_t resp;
  if (!http_transport_request("GET", url, headers, header_count, NULL, &resp)) {
    return result_err(0, "Cannot reach server");
  }

  printf("REST: Lookup %s => Status: %ld, Body: %.200s\n", rfid, resp.status, resp.body ? resp.body : "null");

  freq_rest_result_t result;
  if (resp.status == 200 && resp.body) {
    const char *json_body = resp.body;
    while (*json_body && *json_body != '{') json_body++;
    cJSON *json = *json_body == '{' ? cJSON_Parse(json_body) : NULL;
    if (!json) {
      printf("REST: JSON parse FAILED for %s (body: %.200s)\n", rfid, resp.body);
      result = result_err(resp.status, "Bad response");
    } else {
      copy_json_string(json, "id", out->id, sizeof(out->id));
      copy_json_string(json, "memberId", out->member_id, sizeof(out->member_id));
      copy_json_string(json, "firstName", out->first_name, sizeof(out->first_name));
      copy_json_string(json, "lastName", out->last_name, sizeof(out->last_name));
      const cJSON *balance = cJSON_GetObjectItemCaseSensitive(json, "balance");
      if (cJSON_IsNumber(balance)) out->balance = (int32_t)balance->valuedouble;
      cJSON_Delete(json);
      printf("REST: OK! Member=%s %s, balance=%ld\n", out->first_name, out->last_name, (long)out->balance);
      result = result_ok(resp.status);
    }
  } else {
    char msg[128];
    extract_error(resp.body, msg, sizeof(msg));
    result = result_err(resp.status, msg[0] ? msg : "Card not recognized");
  }

  http_response_free(&resp);
  return result;
}

freq_rest_result_t freq_rest_join_queue(const char *member_uuid, const char *start_iso,
                                        int32_t duration_min, int32_t party_size,
                                        const char *const *player_uuids, size_t player_count,
                                        const char *court_uuid, const char *match_title,
                                        freq_join_response_t *out) {
  memset(out, 0, sizeof(*out));

  cJSON *req = cJSON_CreateObject();
  cJSON_AddStringToObject(req, "memberId", member_uuid);
  cJSON_AddStringToObject(req, "start", start_iso);
  cJSON_AddNumberToObject(req, "duration", duration_min);
  cJSON_AddNumberToObject(req, "partySize", party_size);
  cJSON *players = cJSON_AddArrayToObject(req, "playerIds");
  for (size_t i = 0; i < player_count; i++) {
    cJSON_AddItemToArray(players, cJSON_CreateString(player_uuids[i]));
  }
  if (court_uuid) cJSON_AddStringToObject(req, "courtId", court_uuid);
  if (match_title) cJSON_AddStringToObject(req, "matchTitle", match_title);

  char *req_body = cJSON_PrintUnformatted(req);
  cJSON_Delete(req);
  if (!req_body) return result_err(0, "OOM formatting request");

  char url[256];
  int n = snprintf(url, sizeof(url), "%s/api/queue", s_base_url);
  if (n < 0 || n >= sizeof(url)) {
    free(req_body);
    return result_err(0, "URL too long");
  }
  http_header_t headers[1] = { { "Content-Type", "application/json" } };

  http_response_t resp;
  bool sent = http_transport_request("POST", url, headers, 1, req_body, &resp);
  free(req_body);
  if (!sent) return result_err(0, "Cannot reach server");

  freq_rest_result_t result;
  if ((resp.status == 200 || resp.status == 201) && resp.body) {
    const char *json_body = resp.body;
    while (*json_body && *json_body != '{') json_body++;
    cJSON *json = *json_body == '{' ? cJSON_Parse(json_body) : NULL;
    if (!json) {
      result = result_err(resp.status, "Bad response");
    } else {
      copy_json_string(json, "status", out->status, sizeof(out->status));
      copy_json_string(json, "id", out->entry_id, sizeof(out->entry_id));
      copy_json_string(json, "court_name", out->court_name, sizeof(out->court_name));
      copy_json_string(json, "estimatedWait", out->estimated_wait, sizeof(out->estimated_wait));
      const cJSON *pos = cJSON_GetObjectItemCaseSensitive(json, "position");
      if (cJSON_IsNumber(pos)) out->position = (int32_t)pos->valuedouble;
      cJSON_Delete(json);
      result = result_ok(resp.status);
    }
  } else {
    char msg[128];
    extract_error(resp.body, msg, sizeof(msg));
    result = result_err(resp.status, msg[0] ? msg : "Unable to join queue");
  }

  http_response_free(&resp);
  return result;
}

freq_rest_result_t freq_rest_cancel_queue(const char *entry_id) {
  if (!is_valid_url_path_segment(entry_id)) return result_err(0, "Invalid entry ID");

  char url[256];
  int n = snprintf(url, sizeof(url), "%s/api/queue/%s", s_base_url, entry_id);
  if (n < 0 || n >= sizeof(url)) return result_err(0, "URL too long");

  http_header_t headers[1];
  size_t header_count = 0;
  if (s_api_key[0]) {
    headers[0].name = "x-api-key";
    headers[0].value = s_api_key;
    header_count = 1;
  }

  http_response_t resp;
  if (!http_transport_request("DELETE", url, headers, header_count, NULL, &resp)) {
    return result_err(0, "Cannot reach server");
  }

  freq_rest_result_t result;
  if (resp.status == 200 || resp.status == 204) {
    result = result_ok(resp.status);
  } else {
    char msg[128];
    extract_error(resp.body, msg, sizeof(msg));
    result = result_err(resp.status, msg[0] ? msg : "Cancel failed");
  }

  http_response_free(&resp);
  return result;
}

#ifdef ESP_PLATFORM
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
static void wake_task(void *arg) {
  (void)arg;
  char url[256];
  int n = snprintf(url, sizeof(url), "%s/api/display/publish-all", s_base_url);
  if (n >= 0 && n < sizeof(url)) {
    http_header_t headers[2] = {
      { "Content-Type", "application/json" },
      { "x-api-key", s_api_key }
    };
    /* Retry up to 15 times (30 seconds) to wait for Wi-Fi connection and wake Vercel */
    for (int i = 0; i < 15; i++) {
        http_response_t resp;
        if (http_transport_request("POST", url, headers, 2, "{}", &resp)) {
            bool ok = (resp.status == 200);
            http_response_free(&resp);
            if (ok) break;
        }
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
  }
  vTaskDelete(NULL);
}
#endif

void freq_rest_wake_server(void) {
#ifdef ESP_PLATFORM
  xTaskCreate(wake_task, "wake_task", 4096, NULL, 5, NULL);
#else
  char url[256];
  int n = snprintf(url, sizeof(url), "%s/api/display/publish-all", s_base_url);
  if (n < 0 || n >= sizeof(url)) return;

  http_header_t headers[2] = {
    { "Content-Type", "application/json" },
    { "x-api-key", s_api_key }
  };
  http_response_t resp;
  if (http_transport_request("POST", url, headers, 2, "{}", &resp)) {
      http_response_free(&resp);
  }
#endif
}
