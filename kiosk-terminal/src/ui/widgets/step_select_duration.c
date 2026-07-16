#include "step_select_duration.h"
#include "../theme/kiosk_theme.h"
#include <stdlib.h>
#include <stdio.h>

typedef struct {
  int32_t duration_min;
  step_select_duration_cb_t cb;
  void *user_data;
} duration_closure_t;

static void free_closure_cb(lv_event_t *e) {
  free(lv_event_get_user_data(e));
}

static void click_cb(lv_event_t *e) {
  duration_closure_t *c = lv_event_get_user_data(e);
  c->cb(c->user_data, c->duration_min);
}

lv_obj_t *step_select_duration_create(lv_obj_t *parent, const kiosk_products_config_t *config,
                                       step_select_duration_cb_t on_select, void *user_data) {
  lv_obj_t *root = lv_obj_create(parent);
  lv_obj_remove_style_all(root);
  lv_obj_set_size(root, lv_pct(100), lv_pct(100));
  lv_obj_set_flex_flow(root, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(root, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_all(root, 24, 0);
  lv_obj_set_style_pad_row(root, 24, 0);

  lv_obj_t *title = lv_label_create(root);
  lv_label_set_text(title, "Duration");
  lv_obj_set_style_text_font(title, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(title, KIOSK_COLOR_ZINC_100, 0);

  lv_obj_t *row = lv_obj_create(root);
  lv_obj_remove_style_all(row);
  lv_obj_set_width(row, lv_pct(90));
  lv_obj_set_height(row, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(row, LV_FLEX_ALIGN_SPACE_EVENLY, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  for (uint8_t i = 0; i < config->duration_count; i++) {
    int32_t d = config->durations_min[i];
    /* Price preview intentionally NOT divided by party size here, matching
     * SelectDuration.tsx exactly (rate * (duration/30) with no party-size
     * split) — the party-size-aware charge only appears later, in Confirm. */
    int32_t total = (config->rates[i] * d) / 30;

    lv_obj_t *tile = lv_btn_create(row);
    lv_obj_add_style(tile, &kiosk_style_tile, 0);
    lv_obj_set_width(tile, lv_pct(28));
    lv_obj_set_height(tile, 100);
    lv_obj_set_flex_flow(tile, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(tile, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

    char dur_buf[8];
    snprintf(dur_buf, sizeof(dur_buf), "%d", (int)d);
    lv_obj_t *dur_label = lv_label_create(tile);
    lv_label_set_text(dur_label, dur_buf);
    lv_obj_set_style_text_font(dur_label, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(dur_label, KIOSK_COLOR_ZINC_100, 0);

    lv_obj_t *min_label = lv_label_create(tile);
    lv_label_set_text(min_label, "min");
    lv_obj_set_style_text_font(min_label, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(min_label, KIOSK_COLOR_ZINC_500, 0);

    char price_buf[16];
    snprintf(price_buf, sizeof(price_buf), "P%d", (int)total);
    lv_obj_t *price_label = lv_label_create(tile);
    lv_label_set_text(price_label, price_buf);
    lv_obj_set_style_text_font(price_label, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(price_label, KIOSK_COLOR_ZINC_400, 0);

    duration_closure_t *closure = malloc(sizeof(duration_closure_t));
    closure->duration_min = d;
    closure->cb = on_select;
    closure->user_data = user_data;
    lv_obj_add_event_cb(tile, click_cb, LV_EVENT_CLICKED, closure);
    lv_obj_add_event_cb(tile, free_closure_cb, LV_EVENT_DELETE, closure);
  }

  return root;
}
