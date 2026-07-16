#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/SelectDuration.tsx. */
typedef void (*step_select_duration_cb_t)(void *user_data, int32_t duration_min);

lv_obj_t *step_select_duration_create(lv_obj_t *parent, const kiosk_products_config_t *config,
                                       step_select_duration_cb_t on_select, void *user_data);
