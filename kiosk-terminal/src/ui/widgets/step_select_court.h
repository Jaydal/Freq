#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/SelectCourt.tsx. */
typedef void (*step_select_court_cb_t)(void *user_data, const court_option_t *chosen);

lv_obj_t *step_select_court_create(lv_obj_t *parent,
                                    const char *member_name, int32_t balance,
                                    const court_option_t *courts, uint8_t count,
                                    step_select_court_cb_t on_select,
                                    void (*on_cancel)(void *), void *cancel_user_data,
                                    void *user_data);
