#pragma once

#include "lvgl.h"
#include "../../data/kiosk_model.h"

/* Mirrors web/src/components/terminal/CourtStatusCard.tsx. Creates a new
 * card each call — screens recreate cards on refresh rather than mutating
 * them in place. The court_idx is used by the local timer refresh events
 * to fetch fresh data. */
lv_obj_t *court_status_card_create(lv_obj_t *parent, const court_status_t *court, uint8_t court_idx);
