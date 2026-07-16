#include "queue_list.h"
#include "../theme/kiosk_theme.h"
#include <stdio.h>

static void set_label(lv_obj_t *parent, const char *text, const lv_font_t *font, lv_color_t color) {
  lv_obj_t *label = lv_label_create(parent);
  lv_label_set_text(label, text);
  lv_obj_set_style_text_font(label, font, 0);
  lv_obj_set_style_text_color(label, color, 0);
}

static lv_obj_t *make_row_container(lv_obj_t *parent) {
  lv_obj_t *row = lv_obj_create(parent);
  lv_obj_remove_style_all(row);
  lv_obj_set_width(row, lv_pct(100));
  lv_obj_set_height(row, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(row, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_column(row, 8, 0);
  return row;
}

lv_obj_t *queue_list_create(lv_obj_t *parent, const queue_row_t *rows, uint8_t count) {
  lv_obj_t *list = lv_obj_create(parent);
  lv_obj_remove_style_all(list);
  lv_obj_set_width(list, lv_pct(100));
  lv_obj_set_height(list, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(list, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(list, 8, 0);

  if (count == 0) {
    set_label(list, "No one waiting", &lv_font_montserrat_14, KIOSK_COLOR_ZINC_500);
    return list;
  }

  for (uint8_t i = 0; i < count; i++) {
    const queue_row_t *q = &rows[i];
    lv_obj_t *row = lv_obj_create(list);
    lv_obj_set_width(row, lv_pct(100));
    lv_obj_set_height(row, LV_SIZE_CONTENT);
    lv_obj_set_style_bg_color(row, KIOSK_COLOR_ZINC_800, 0);
    lv_obj_set_style_bg_opa(row, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(row, 0, 0);
    lv_obj_set_style_radius(row, 6, 0);
    lv_obj_set_style_pad_all(row, 8, 0);
    lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(row, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_column(row, 12, 0);

    lv_obj_t *badge = lv_obj_create(row);
    lv_obj_set_size(badge, 24, 24);
    lv_obj_set_style_radius(badge, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(badge, 0, 0);
    lv_obj_set_style_bg_color(badge, q->position == 1 ? KIOSK_COLOR_EMERALD_500 : KIOSK_COLOR_ZINC_700, 0);
    lv_obj_set_style_bg_opa(badge, LV_OPA_COVER, 0);
    lv_obj_set_flex_align(badge, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    char pos_buf[4];
    snprintf(pos_buf, sizeof(pos_buf), "%d", (int)q->position);
    set_label(badge, pos_buf, &lv_font_montserrat_14,
              q->position == 1 ? KIOSK_COLOR_EMERALD_400 : KIOSK_COLOR_ZINC_400);

    char name_buf[64];
    snprintf(name_buf, sizeof(name_buf), "%s %s", q->first_name, q->last_name);
    set_label(row, name_buf, &lv_font_montserrat_16, KIOSK_COLOR_ZINC_100);

    lv_obj_t *type_badge = lv_obj_create(row);
    lv_obj_remove_style_all(type_badge);
    lv_obj_set_size(type_badge, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    lv_obj_set_style_bg_color(type_badge, KIOSK_COLOR_ZINC_700, 0);
    lv_obj_set_style_bg_opa(type_badge, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(type_badge, 4, 0);
    lv_obj_set_style_pad_hor(type_badge, 6, 0);
    lv_obj_set_style_pad_ver(type_badge, 2, 0);
    set_label(type_badge, q->match_type, &lv_font_montserrat_14, KIOSK_COLOR_ZINC_300);

    set_label(row, q->court_name[0] ? q->court_name : "Any", &lv_font_montserrat_14, KIOSK_COLOR_ZINC_500);

    char dur_buf[8];
    snprintf(dur_buf, sizeof(dur_buf), "%dm", (int)q->duration_min);
    set_label(row, dur_buf, &lv_font_montserrat_14, KIOSK_COLOR_ZINC_500);

    set_label(row, q->estimated_wait, &lv_font_montserrat_14, KIOSK_COLOR_ZINC_400);
  }

  return list;
}
