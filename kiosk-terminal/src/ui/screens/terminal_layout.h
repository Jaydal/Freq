#pragma once

#include "lvgl.h"
#include <stdbool.h>

typedef void (*terminal_close_cb_t)(void *user_data);

typedef struct {
  lv_obj_t *root;    /* full-screen black backdrop */
  lv_obj_t *content; /* step widgets are created inside this */
  lv_obj_t *divider; 
  lv_obj_t *sidebar; 
} terminal_layout_t;

terminal_layout_t terminal_layout_create(lv_obj_t *parent);
void terminal_layout_set_sidebar(terminal_layout_t *layout, bool show_sidebar);
