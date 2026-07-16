#pragma once

#include "lvgl.h"
#include <stdbool.h>

/* Mirrors web/src/components/terminal/TerminalLayout.tsx — the small
 * centered "device frame" card (5:3 aspect) used by every booking-flow
 * step, with an optional right sidebar for CourtOverview. */
typedef void (*terminal_close_cb_t)(void *user_data);

typedef struct {
  lv_obj_t *root;    /* full-screen black backdrop */
  lv_obj_t *content; /* step widgets are created inside this */
  lv_obj_t *sidebar; /* NULL when show_sidebar is false */
} terminal_layout_t;

terminal_layout_t terminal_layout_create(lv_obj_t *parent, bool show_sidebar,
                                         terminal_close_cb_t on_close, void *close_user_data);
