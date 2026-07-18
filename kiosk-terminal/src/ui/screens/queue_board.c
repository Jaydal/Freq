#include "queue_board.h"
#include "../theme/kiosk_theme.h"
#include "../widgets/court_status_card.h"
#include "../widgets/queue_list.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../../net/pn532_i2c.h"

typedef struct {
  queue_board_scan_cb_t cb;
  void *user_data;
  char rfid[16];
} scan_closure_t;

static void free_closure_cb(lv_event_t *e) {
  free(lv_event_get_user_data(e));
}

static void scan_click_cb(lv_event_t *e) {
  scan_closure_t *c = lv_event_get_user_data(e);
  c->cb(c->user_data, c->rfid);
}

static void add_scan_button(lv_obj_t *parent, const char *label_text, const char *rfid,
                             queue_board_scan_cb_t cb, void *user_data) {
  lv_obj_t *btn = lv_btn_create(parent);
  lv_obj_set_size(btn, 36, 36);
  lv_obj_set_style_bg_color(btn, KIOSK_COLOR_ZINC_900, 0);
  lv_obj_set_style_bg_opa(btn, LV_OPA_90, 0);
  lv_obj_set_style_border_color(btn, KIOSK_COLOR_ZINC_700, 0);
  lv_obj_set_style_border_width(btn, 1, 0);
  lv_obj_set_style_radius(btn, 6, 0);
  lv_obj_t *label = lv_label_create(btn);
  lv_label_set_text(label, label_text);
  lv_obj_set_style_text_font(label, &lv_font_montserrat_14, 0);
  lv_obj_set_style_text_color(label, KIOSK_COLOR_EMERALD_400, 0);
  lv_obj_center(label);

  scan_closure_t *closure = malloc(sizeof(scan_closure_t));
  closure->cb = cb;
  closure->user_data = user_data;
  snprintf(closure->rfid, sizeof(closure->rfid), "%s", rfid);
  lv_obj_add_event_cb(btn, scan_click_cb, LV_EVENT_CLICKED, closure);
  lv_obj_add_event_cb(btn, free_closure_cb, LV_EVENT_DELETE, closure);
}

lv_obj_t *queue_board_create(lv_obj_t *parent, const kiosk_board_t *board,
                              queue_board_scan_cb_t on_scan, void *user_data) {
  lv_obj_t *root = lv_obj_create(parent);
  lv_obj_remove_style_all(root);
  lv_obj_add_style(root, &kiosk_style_screen_bg, 0);
  lv_obj_set_size(root, lv_pct(100), lv_pct(100));
  lv_obj_set_style_pad_all(root, 16, 0);

  lv_obj_t *nfc_status = lv_label_create(root);
  if (pn532_is_online()) {
      lv_label_set_text(nfc_status, "NFC: OK");
      lv_obj_set_style_text_color(nfc_status, KIOSK_COLOR_EMERALD_400, 0);
  } else {
      lv_label_set_text(nfc_status, "NFC: OFFLINE");
      lv_obj_set_style_text_color(nfc_status, KIOSK_COLOR_RED_500, 0);
  }
  lv_obj_set_style_text_font(nfc_status, &lv_font_montserrat_14, 0);
  lv_obj_align(nfc_status, LV_ALIGN_TOP_RIGHT, 0, 0);

  lv_obj_t *brand = lv_label_create(root);
  lv_label_set_text(brand, "Paddle Point Queueing Terminal");
  lv_obj_set_style_text_font(brand, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(brand, KIOSK_COLOR_EMERALD_400, 0);
  lv_obj_align(brand, LV_ALIGN_TOP_LEFT, 0, 0);

  lv_obj_t *columns = lv_obj_create(root);
  lv_obj_remove_style_all(columns);
  lv_obj_set_size(columns, lv_pct(100), lv_pct(100));
  lv_obj_set_flex_flow(columns, LV_FLEX_FLOW_ROW);
  lv_obj_set_style_pad_column(columns, 16, 0);
  lv_obj_set_style_pad_top(columns, 48, 0);

  lv_obj_t *left = lv_obj_create(columns);
  lv_obj_remove_style_all(left);
  lv_obj_set_width(left, lv_pct(58));
  lv_obj_set_height(left, lv_pct(100));
  lv_obj_set_flex_flow(left, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(left, 12, 0);
  lv_obj_set_scrollbar_mode(left, LV_SCROLLBAR_MODE_OFF);

  lv_obj_t *courts_title = lv_label_create(left);
  lv_label_set_text(courts_title, "Courts");
  lv_obj_set_style_text_font(courts_title, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(courts_title, KIOSK_COLOR_ZINC_500, 0);

  for (uint8_t i = 0; i < board->court_count; i++) {
    court_status_card_create(left, &board->courts[i], i);
  }

  lv_obj_t *right = lv_obj_create(columns);
  lv_obj_remove_style_all(right);
  lv_obj_set_flex_grow(right, 1);
  lv_obj_set_height(right, lv_pct(100));
  lv_obj_set_flex_flow(right, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(right, 12, 0);

  lv_obj_t *queue_panel = lv_obj_create(right);
  lv_obj_add_style(queue_panel, &kiosk_style_panel_bg, 0);
  lv_obj_set_width(queue_panel, lv_pct(100));
  lv_obj_set_flex_grow(queue_panel, 1);
  lv_obj_set_flex_flow(queue_panel, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(queue_panel, 10, 0);
  lv_obj_set_scrollbar_mode(queue_panel, LV_SCROLLBAR_MODE_OFF);

  char queue_title[24];
  snprintf(queue_title, sizeof(queue_title), "QUEUE (%d)", board->queue_count);
  lv_obj_t *queue_title_label = lv_label_create(queue_panel);
  lv_label_set_text(queue_title_label, queue_title);
  lv_obj_set_style_text_font(queue_title_label, &lv_font_montserrat_14, 0);
  lv_obj_set_style_text_color(queue_title_label, KIOSK_COLOR_ZINC_500, 0);

  queue_list_create(queue_panel, board->queue, board->queue_count);

  return root;
}
