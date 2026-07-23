#pragma once

#include "lvgl.h"

lv_obj_t *screensaver_create(lv_obj_t *parent, void (*on_click)(void *), void *user_data);

