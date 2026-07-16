#include "step_select_game_type.h"
#include "../theme/kiosk_theme.h"
#include <stdlib.h>

typedef struct {
  game_type_t game_type;
  step_select_game_type_cb_t cb;
  void *user_data;
} game_type_closure_t;

static void free_closure_cb(lv_event_t *e) {
  free(lv_event_get_user_data(e));
}

static void click_cb(lv_event_t *e) {
  game_type_closure_t *c = lv_event_get_user_data(e);
  c->cb(c->user_data, c->game_type);
}

static lv_obj_t *make_tile(lv_obj_t *parent, const char *big, const char *sub) {
  lv_obj_t *tile = lv_btn_create(parent);
  lv_obj_add_style(tile, &kiosk_style_tile, 0);
  lv_obj_set_width(tile, lv_pct(45));
  lv_obj_set_height(tile, 120);
  lv_obj_set_flex_flow(tile, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(tile, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  lv_obj_t *big_label = lv_label_create(tile);
  lv_label_set_text(big_label, big);
  lv_obj_set_style_text_font(big_label, &lv_font_montserrat_32, 0);
  lv_obj_set_style_text_color(big_label, KIOSK_COLOR_ZINC_100, 0);

  lv_obj_t *sub_label = lv_label_create(tile);
  lv_label_set_text(sub_label, sub);
  lv_obj_set_style_text_font(sub_label, &lv_font_montserrat_14, 0);
  lv_obj_set_style_text_color(sub_label, KIOSK_COLOR_ZINC_400, 0);

  return tile;
}

lv_obj_t *step_select_game_type_create(lv_obj_t *parent, step_select_game_type_cb_t on_select, void *user_data) {
  lv_obj_t *root = lv_obj_create(parent);
  lv_obj_remove_style_all(root);
  lv_obj_set_size(root, lv_pct(100), lv_pct(100));
  lv_obj_set_flex_flow(root, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(root, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_all(root, 24, 0);
  lv_obj_set_style_pad_row(root, 24, 0);

  lv_obj_t *title = lv_label_create(root);
  lv_label_set_text(title, "Game Type");
  lv_obj_set_style_text_font(title, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(title, KIOSK_COLOR_ZINC_100, 0);

  lv_obj_t *row = lv_obj_create(root);
  lv_obj_remove_style_all(row);
  lv_obj_set_width(row, lv_pct(90));
  lv_obj_set_height(row, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(row, LV_FLEX_ALIGN_SPACE_EVENLY, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  lv_obj_t *t1 = make_tile(row, "1 vs 1", "Singles");
  game_type_closure_t *c1 = malloc(sizeof(game_type_closure_t));
  c1->game_type = GAME_TYPE_1V1;
  c1->cb = on_select;
  c1->user_data = user_data;
  lv_obj_add_event_cb(t1, click_cb, LV_EVENT_CLICKED, c1);
  lv_obj_add_event_cb(t1, free_closure_cb, LV_EVENT_DELETE, c1);

  lv_obj_t *t2 = make_tile(row, "2 vs 2", "Doubles");
  game_type_closure_t *c2 = malloc(sizeof(game_type_closure_t));
  c2->game_type = GAME_TYPE_2V2;
  c2->cb = on_select;
  c2->user_data = user_data;
  lv_obj_add_event_cb(t2, click_cb, LV_EVENT_CLICKED, c2);
  lv_obj_add_event_cb(t2, free_closure_cb, LV_EVENT_DELETE, c2);

  return root;
}
