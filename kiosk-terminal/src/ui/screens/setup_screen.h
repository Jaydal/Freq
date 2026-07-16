#pragma once

#include "lvgl.h"

/* First-boot (and long-press re-access) WiFi configuration screen.
 * Collects SSID + password via an on-screen keyboard and persists them
 * through kiosk_config_save(), then invokes on_done. */
typedef void (*setup_done_cb_t)(void *user_data);

lv_obj_t *setup_screen_create(lv_obj_t *parent, setup_done_cb_t on_done, void *user_data);
