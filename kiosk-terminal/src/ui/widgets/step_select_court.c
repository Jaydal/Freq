#include "step_select_court.h"
#include "../theme/kiosk_theme.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  court_option_t court;
  step_select_court_cb_t cb;
  void *user_data;
} court_btn_closure_t;

static void free_closure_cb(lv_event_t *e) {
  free(lv_event_get_user_data(e));
}

static void click_cb(lv_event_t *e) {
  court_btn_closure_t *c = lv_event_get_user_data(e);
  c->cb(c->user_data, &c->court);
}

static lv_obj_t *make_tile(lv_obj_t *parent, const char *name, const char *badge_text, lv_color_t badge_color,
                            bool disabled) {
  lv_obj_t *tile = lv_btn_create(parent);
  lv_obj_add_style(tile, &kiosk_style_tile, 0);
  lv_obj_set_style_bg_color(tile, KIOSK_COLOR_ZINC_900, 0);
  lv_obj_set_width(tile, lv_pct(48));
  lv_obj_set_flex_flow(tile, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(tile, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
  lv_obj_set_style_pad_row(tile, 20, 0);
  if (disabled) {
    lv_obj_add_state(tile, LV_STATE_DISABLED);
    lv_obj_set_style_bg_opa(tile, LV_OPA_50, LV_STATE_DISABLED);
  }

  lv_obj_t *name_label = lv_label_create(tile);
  lv_label_set_text(name_label, name);
  lv_obj_set_style_text_font(name_label, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(name_label, KIOSK_COLOR_ZINC_100, 0);

  lv_obj_t *badge = lv_obj_create(tile);
  lv_obj_remove_style_all(badge);
  lv_obj_set_size(badge, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
  lv_obj_set_style_bg_color(badge, badge_color, 0);
  lv_obj_set_style_bg_opa(badge, LV_OPA_20, 0);
  lv_obj_set_style_radius(badge, 4, 0);
  lv_obj_set_style_pad_hor(badge, 6, 0);
  lv_obj_set_style_pad_ver(badge, 2, 0);
  lv_obj_t *badge_label = lv_label_create(badge);
  lv_label_set_text(badge_label, badge_text);
  lv_obj_set_style_text_font(badge_label, &lv_font_montserrat_14, 0);
  lv_obj_set_style_text_color(badge_label, badge_color, 0);

  return tile;
}

lv_obj_t *step_select_court_create(lv_obj_t *parent, const court_option_t *courts, uint8_t count,
                                    step_select_court_cb_t on_select, void *user_data) {
  lv_obj_t *root = lv_obj_create(parent);
  lv_obj_remove_style_all(root);
  lv_obj_set_size(root, lv_pct(100), lv_pct(100));
  lv_obj_set_flex_flow(root, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_all(root, 24, 0);
  lv_obj_set_style_pad_row(root, 16, 0);

  lv_obj_t *title = lv_label_create(root);
  lv_label_set_text(title, "Select Court");
  lv_obj_set_style_text_font(title, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(title, KIOSK_COLOR_ZINC_100, 0);

  lv_obj_t *grid = lv_obj_create(root);
  lv_obj_remove_style_all(grid);
  lv_obj_set_width(grid, lv_pct(100));
  lv_obj_set_flex_grow(grid, 1);
  lv_obj_set_flex_flow(grid, LV_FLEX_FLOW_ROW_WRAP);
  lv_obj_set_style_pad_column(grid, 16, 0);
  lv_obj_set_style_pad_row(grid, 16, 0);

  /* "Any Court" — first available, always enabled (mirrors SelectCourt.tsx). */
  court_btn_closure_t *any_closure = malloc(sizeof(court_btn_closure_t));
  memset(&any_closure->court, 0, sizeof(any_closure->court));
  snprintf(any_closure->court.name, sizeof(any_closure->court.name), "Any Court");
  snprintf(any_closure->court.status, sizeof(any_closure->court.status), "Available");
  any_closure->cb = on_select;
  any_closure->user_data = user_data;
  lv_obj_t *any_tile = make_tile(grid, "Any Court", "First available", KIOSK_COLOR_EMERALD_400, false);
  lv_obj_add_event_cb(any_tile, click_cb, LV_EVENT_CLICKED, any_closure);
  lv_obj_add_event_cb(any_tile, free_closure_cb, LV_EVENT_DELETE, any_closure);

  for (uint8_t i = 0; i < count; i++) {
    const court_option_t *c = &courts[i];
    bool busy = strcmp(c->status, "Available") != 0;
    lv_color_t badge_color = busy ? KIOSK_COLOR_ZINC_400 : KIOSK_COLOR_EMERALD_400;
    const char *badge_text = busy ? "In use" : "Available";

    court_btn_closure_t *closure = malloc(sizeof(court_btn_closure_t));
    closure->court = *c;
    closure->cb = on_select;
    closure->user_data = user_data;

    lv_obj_t *tile = make_tile(grid, c->name, badge_text, badge_color, busy);
    if (!busy) {
      lv_obj_add_event_cb(tile, click_cb, LV_EVENT_CLICKED, closure);
    }
    lv_obj_add_event_cb(tile, free_closure_cb, LV_EVENT_DELETE, closure);
  }

  return root;
}
