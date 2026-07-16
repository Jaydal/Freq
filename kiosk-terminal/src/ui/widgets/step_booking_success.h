#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/BookingSuccess.tsx. */
lv_obj_t *step_booking_success_create(lv_obj_t *parent, const booking_result_t *result);
