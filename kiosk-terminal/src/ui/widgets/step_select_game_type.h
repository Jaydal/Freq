#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/SelectGameType.tsx. */
typedef void (*step_select_game_type_cb_t)(void *user_data, game_type_t chosen);

lv_obj_t *step_select_game_type_create(lv_obj_t *parent, step_select_game_type_cb_t on_select, void *user_data);
