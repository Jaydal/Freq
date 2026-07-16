#pragma once

#include "../data/kiosk_model.h"
#include <stddef.h>
#include <stdbool.h>

/* Parses a `freq/board` JSON payload (see web/src/lib/queue/board-snapshot.ts)
 * into a kiosk_board_t. Returns false on malformed JSON. */
bool board_parse(const char *json, size_t len, kiosk_board_t *out);
