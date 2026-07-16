#include "kiosk_theme.h"
#include <stdio.h>

lv_style_t kiosk_style_card_available;
lv_style_t kiosk_style_card_preparing;
lv_style_t kiosk_style_card_in_game;
lv_style_t kiosk_style_screen_bg;
lv_style_t kiosk_style_panel_bg;
lv_style_t kiosk_style_btn_primary;
lv_style_t kiosk_style_btn_secondary;
lv_style_t kiosk_style_tile;

static void init_card_style(lv_style_t *style, lv_color_t border_color) {
  lv_style_init(style);
  lv_style_set_bg_color(style, KIOSK_COLOR_ZINC_900);
  lv_style_set_bg_opa(style, LV_OPA_COVER);
  lv_style_set_border_side(style, LV_BORDER_SIDE_LEFT);
  lv_style_set_border_width(style, 4);
  lv_style_set_border_color(style, border_color);
  lv_style_set_radius(style, 8);
  lv_style_set_pad_all(style, 12);
}

void kiosk_theme_init(void) {
  init_card_style(&kiosk_style_card_available, KIOSK_COLOR_ZINC_600);
  init_card_style(&kiosk_style_card_preparing, KIOSK_COLOR_AMBER_400);
  init_card_style(&kiosk_style_card_in_game, KIOSK_COLOR_EMERALD_400);

  lv_style_init(&kiosk_style_screen_bg);
  lv_style_set_bg_color(&kiosk_style_screen_bg, KIOSK_COLOR_BLACK);
  lv_style_set_bg_opa(&kiosk_style_screen_bg, LV_OPA_COVER);
  lv_style_set_border_width(&kiosk_style_screen_bg, 0);
  lv_style_set_radius(&kiosk_style_screen_bg, 0);
  lv_style_set_pad_all(&kiosk_style_screen_bg, 0);

  lv_style_init(&kiosk_style_panel_bg);
  lv_style_set_bg_color(&kiosk_style_panel_bg, KIOSK_COLOR_ZINC_900);
  lv_style_set_bg_opa(&kiosk_style_panel_bg, LV_OPA_COVER);
  lv_style_set_radius(&kiosk_style_panel_bg, 8);
  lv_style_set_pad_all(&kiosk_style_panel_bg, 12);
  lv_style_set_border_width(&kiosk_style_panel_bg, 0);

  lv_style_init(&kiosk_style_btn_primary);
  lv_style_set_bg_color(&kiosk_style_btn_primary, KIOSK_COLOR_EMERALD_500);
  lv_style_set_bg_opa(&kiosk_style_btn_primary, LV_OPA_COVER);
  lv_style_set_text_color(&kiosk_style_btn_primary, KIOSK_COLOR_BLACK);
  lv_style_set_radius(&kiosk_style_btn_primary, 8);
  lv_style_set_min_height(&kiosk_style_btn_primary, KIOSK_PRIMARY_TOUCH_PX);

  lv_style_init(&kiosk_style_btn_secondary);
  lv_style_set_bg_color(&kiosk_style_btn_secondary, KIOSK_COLOR_ZINC_800);
  lv_style_set_bg_opa(&kiosk_style_btn_secondary, LV_OPA_COVER);
  lv_style_set_text_color(&kiosk_style_btn_secondary, KIOSK_COLOR_ZINC_300);
  lv_style_set_radius(&kiosk_style_btn_secondary, 8);
  lv_style_set_min_height(&kiosk_style_btn_secondary, KIOSK_MIN_TOUCH_PX);

  lv_style_init(&kiosk_style_tile);
  lv_style_set_bg_color(&kiosk_style_tile, KIOSK_COLOR_ZINC_900);
  lv_style_set_bg_opa(&kiosk_style_tile, LV_OPA_COVER);
  lv_style_set_border_color(&kiosk_style_tile, KIOSK_COLOR_ZINC_700);
  lv_style_set_border_width(&kiosk_style_tile, 1);
  lv_style_set_radius(&kiosk_style_tile, 8);
  lv_style_set_pad_all(&kiosk_style_tile, 12);
  lv_style_set_min_height(&kiosk_style_tile, KIOSK_MIN_TOUCH_PX);
}

void kiosk_format_time(char *buf, size_t buf_size, int32_t seconds) {
  if (seconds < 0) seconds = 0;
  int32_t m = seconds / 60;
  int32_t s = seconds % 60;
  snprintf(buf, buf_size, "%02d:%02d", (int)m, (int)s);
}
