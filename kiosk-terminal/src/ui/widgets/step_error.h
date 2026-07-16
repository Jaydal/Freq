#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/ErrorScreen.tsx. */
typedef void (*step_error_cb_t)(void *user_data);

lv_obj_t *step_error_create(lv_obj_t *parent, const kiosk_error_t *error, step_error_cb_t on_retry,
                             void *user_data);
