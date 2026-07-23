#pragma once

#include "lvgl.h"
#include <stdlib.h>

/* Shared closure type for step "back" buttons.
 * Cast lv_event_get_user_data(e) to back_closure_t*, then call cb(user_data). */
typedef struct {
  void (*cb)(void *);
  void *user_data;
} back_closure_t;

/* Shared cleanup callback: frees the closure struct allocated for a button.
 * Attach via lv_obj_add_event_cb(btn, free_closure_cb, LV_EVENT_DELETE, closure). */
void free_closure_cb(lv_event_t *e);

/* Mirrors web/src/components/terminal/BookingStepper.tsx.
 * Creates a compact header with member info card + 4-step progress indicator
 * + cancel button. Returns the root container.
 * parent: LVGL parent object
 * current_step: 0-3 (Court, Game Type, Duration, Confirm)
 * member_name: formatted "First Last" or NULL
 * balance: member's current balance or -1 if unknown
 * on_cancel: callback when Cancel Booking is pressed, or NULL
 * cancel_user_data: user data for on_cancel
 */
lv_obj_t *booking_stepper_create(lv_obj_t *parent, int current_step,
                                   const char *member_name, int32_t balance,
                                   void (*on_cancel)(void *), void *cancel_user_data);
