#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/SelectGameType.tsx. */
typedef void (*step_select_game_type_cb_t)(void *user_data, game_type_t chosen);

lv_obj_t *step_select_game_type_create(lv_obj_t *parent,
                                        const char *member_name, int32_t balance,
                                        step_select_game_type_cb_t on_select,
                                        void (*on_cancel)(void *), void *cancel_user_data,
                                        void (*on_back)(void *), void *back_user_data,
                                        void *user_data);
