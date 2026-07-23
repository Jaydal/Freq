#include "screensaver.h"
#include "../theme/kiosk_theme.h"

static void click_cb(lv_event_t *e) {
    void (*on_click)(void *) = lv_event_get_user_data(e);
    if (on_click) {
        on_click(NULL);
    }
}


lv_obj_t *screensaver_create(lv_obj_t *parent, void (*on_click)(void *), void *user_data) {
    lv_obj_t *root = lv_obj_create(parent);
    lv_obj_remove_style_all(root);
    lv_obj_set_size(root, lv_pct(100), lv_pct(100));
    lv_obj_add_style(root, &kiosk_style_screen_bg, 0);

    lv_obj_t *container = lv_obj_create(root);
    lv_obj_remove_style_all(container);
    lv_obj_set_size(container, lv_pct(100), lv_pct(100));

    lv_obj_t *title = lv_label_create(container);
    lv_label_set_text(title, "Paddle Point");
    lv_obj_set_style_text_font(title, &lv_font_montserrat_32, 0);
    lv_obj_set_style_text_color(title, kiosk_theme_color_primary(), 0);
    lv_obj_align(title, LV_ALIGN_CENTER, 0, -40);

    lv_obj_t *subtitle = lv_label_create(container);
    lv_label_set_text(subtitle, "Tap anywhere to view courts & queue\n\nScan your RFID card to book!");
    lv_obj_set_style_text_font(subtitle, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(subtitle, kiosk_theme_color_text_muted(), 0);
    lv_obj_set_style_text_align(subtitle, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(subtitle, LV_ALIGN_CENTER, 0, 40);


    /* Invisible button over everything */
    lv_obj_t *btn = lv_btn_create(root);
    lv_obj_set_size(btn, lv_pct(100), lv_pct(100));
    lv_obj_set_style_bg_opa(btn, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(btn, 0, 0);
    lv_obj_set_style_shadow_width(btn, 0, 0);
    lv_obj_add_event_cb(btn, click_cb, LV_EVENT_CLICKED, on_click);

    return root;
}
