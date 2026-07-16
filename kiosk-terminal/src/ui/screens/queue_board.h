#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/QueueBoard.tsx — the idle screen.
 * No real RFID reader exists yet, so "scan" is a row of mock test buttons
 * (TEST001..TEST005) in the top-right corner standing in for a card tap. */
typedef void (*queue_board_scan_cb_t)(void *user_data, const char *test_rfid);

lv_obj_t *queue_board_create(lv_obj_t *parent, const kiosk_board_t *board,
                              queue_board_scan_cb_t on_scan, void *user_data);
