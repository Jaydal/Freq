#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/QueueList.tsx. */
lv_obj_t *queue_list_create(lv_obj_t *parent, const queue_row_t *rows, uint8_t count);
