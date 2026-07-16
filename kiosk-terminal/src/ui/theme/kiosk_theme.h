#pragma once

#include "lvgl.h"
#include <stddef.h>
#include <stdint.h>

/* Palette ported from the real web terminal's Tailwind classes
 * (zinc/emerald/amber/red), so the simulator visually matches it. */

#define KIOSK_MIN_TOUCH_PX     56
#define KIOSK_PRIMARY_TOUCH_PX 64

#define KIOSK_COLOR_BLACK           lv_color_hex(0x000000)
#define KIOSK_COLOR_ZINC_950        lv_color_hex(0x09090b)
#define KIOSK_COLOR_ZINC_900        lv_color_hex(0x18181b)
#define KIOSK_COLOR_ZINC_800        lv_color_hex(0x27272a)
#define KIOSK_COLOR_ZINC_700        lv_color_hex(0x3f3f46)
#define KIOSK_COLOR_ZINC_600        lv_color_hex(0x52525b)
#define KIOSK_COLOR_ZINC_500        lv_color_hex(0x71717a)
#define KIOSK_COLOR_ZINC_400        lv_color_hex(0xa1a1aa)
#define KIOSK_COLOR_ZINC_300        lv_color_hex(0xd4d4d8)
#define KIOSK_COLOR_ZINC_100        lv_color_hex(0xf4f4f5)

#define KIOSK_COLOR_EMERALD_400     lv_color_hex(0x34d399)
#define KIOSK_COLOR_EMERALD_500     lv_color_hex(0x10b981)
#define KIOSK_COLOR_AMBER_400       lv_color_hex(0xfbbf24)
#define KIOSK_COLOR_AMBER_500       lv_color_hex(0xf59e0b)
#define KIOSK_COLOR_RED_400         lv_color_hex(0xf87171)
#define KIOSK_COLOR_RED_500         lv_color_hex(0xef4444)

/* Call once at startup, before creating any screens. */
void kiosk_theme_init(void);

/* Card left-border-accent variants (mirrors CourtStatusCard's 3 states). */
extern lv_style_t kiosk_style_card_available;
extern lv_style_t kiosk_style_card_preparing;
extern lv_style_t kiosk_style_card_in_game;

/* Generic reusable styles. */
extern lv_style_t kiosk_style_screen_bg;     /* black, full-bleed */
extern lv_style_t kiosk_style_panel_bg;      /* zinc-900 rounded panel */
extern lv_style_t kiosk_style_btn_primary;   /* emerald action button, min touch size */
extern lv_style_t kiosk_style_btn_secondary; /* zinc-800 secondary button, min touch size */
extern lv_style_t kiosk_style_tile;          /* zinc-900 selectable tile (court/game/duration options) */

/* Formats seconds as "MM:SS" into buf (caller-owned, needs >= 6 bytes). */
void kiosk_format_time(char *buf, size_t buf_size, int32_t seconds);
