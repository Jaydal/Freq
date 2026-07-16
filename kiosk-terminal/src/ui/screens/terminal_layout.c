#include "terminal_layout.h"
#include "../theme/kiosk_theme.h"
#include <stdlib.h>

typedef struct {
  terminal_close_cb_t cb;
  void *user_data;
} close_closure_t;

static void close_click_cb(lv_event_t *e) {
  close_closure_t *c = lv_event_get_user_data(e);
  if (c->cb) c->cb(c->user_data);
}

static void free_close_cb(lv_event_t *e) {
  free(lv_event_get_user_data(e));
}

terminal_layout_t terminal_layout_create(lv_obj_t *parent, bool show_sidebar,
                                         terminal_close_cb_t on_close, void *close_user_data) {
  terminal_layout_t layout = { 0 };

  layout.root = lv_obj_create(parent);
  lv_obj_remove_style_all(layout.root);
  lv_obj_add_style(layout.root, &kiosk_style_screen_bg, 0);
  lv_obj_set_size(layout.root, lv_pct(100), lv_pct(100));
  lv_obj_set_flex_flow(layout.root, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(layout.root, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  lv_obj_t *card = lv_obj_create(layout.root);
  lv_obj_set_style_bg_color(card, KIOSK_COLOR_ZINC_950, 0);
  lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
  lv_obj_set_style_border_color(card, KIOSK_COLOR_ZINC_800, 0);
  lv_obj_set_style_border_width(card, 1, 0);
  lv_obj_set_style_radius(card, 16, 0);
  lv_obj_set_style_pad_all(card, 0, 0);
  lv_obj_set_size(card, 820, 492);
  lv_obj_set_flex_flow(card, LV_FLEX_FLOW_ROW);
  lv_obj_clear_flag(card, LV_OBJ_FLAG_SCROLLABLE);

  layout.content = lv_obj_create(card);
  lv_obj_remove_style_all(layout.content);
  lv_obj_set_height(layout.content, lv_pct(100));
  lv_obj_set_flex_grow(layout.content, 1);
  lv_obj_clear_flag(layout.content, LV_OBJ_FLAG_SCROLLABLE);

  if (show_sidebar) {
    lv_obj_t *divider = lv_obj_create(card);
    lv_obj_remove_style_all(divider);
    lv_obj_set_size(divider, 1, lv_pct(100));
    lv_obj_set_style_bg_color(divider, KIOSK_COLOR_ZINC_800, 0);
    lv_obj_set_style_bg_opa(divider, LV_OPA_COVER, 0);

    layout.sidebar = lv_obj_create(card);
    lv_obj_remove_style_all(layout.sidebar);
    lv_obj_set_size(layout.sidebar, 210, lv_pct(100));
    lv_obj_clear_flag(layout.sidebar, LV_OBJ_FLAG_SCROLLABLE);
  }

  if (on_close) {
    lv_obj_t *close_btn = lv_btn_create(card);
    lv_obj_remove_style_all(close_btn);
    lv_obj_set_size(close_btn, 36, 36);
    lv_obj_set_style_bg_color(close_btn, KIOSK_COLOR_ZINC_800, 0);
    lv_obj_set_style_radius(close_btn, 8, 0);
    lv_obj_add_flag(close_btn, LV_OBJ_FLAG_FLOATING);
    lv_obj_align(close_btn, LV_ALIGN_TOP_RIGHT, 8, 8);

    lv_obj_t *close_label = lv_label_create(close_btn);
    lv_label_set_text(close_label, LV_SYMBOL_CLOSE);
    lv_obj_set_style_text_font(close_label, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(close_label, KIOSK_COLOR_ZINC_400, 0);
    lv_obj_center(close_label);

    close_closure_t *c = malloc(sizeof(close_closure_t));
    c->cb = on_close;
    c->user_data = close_user_data;
    lv_obj_add_event_cb(close_btn, close_click_cb, LV_EVENT_CLICKED, c);
    lv_obj_add_event_cb(close_btn, free_close_cb, LV_EVENT_DELETE, c);
  }

  return layout;
}
