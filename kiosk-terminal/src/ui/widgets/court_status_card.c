#include "court_status_card.h"
#include "../theme/kiosk_theme.h"
#include <stdio.h>
#include "../../data/kiosk_data_provider.h"

static lv_obj_t *set_label(lv_obj_t *parent, const char *text, const lv_font_t *font, lv_color_t color) {
  lv_obj_t *label = lv_label_create(parent);
  lv_label_set_text(label, text);
  lv_obj_set_style_text_font(label, font, 0);
  lv_obj_set_style_text_color(label, color, 0);
  return label;
}

static void big_timer_refresh_cb(lv_event_t *e) {
  lv_obj_t *label = lv_event_get_target(e);
  uint8_t court_idx = (uint8_t)(uintptr_t)lv_event_get_user_data(e);
  
  kiosk_board_t board;
  kiosk_data_provider_get()->get_board(&board);
  if (court_idx >= board.court_count) return;
  const court_status_t *court = &board.courts[court_idx];
  
  if (!court_is_active(court)) return;
  
  int32_t elapsed = court_elapsed_sec(court);
  int32_t prep_sec = kiosk_effective_prep_sec(court->duration_min, court->prep_time_sec);
  court_phase_t phase = kiosk_phase_for_elapsed(elapsed, prep_sec);
  
  int32_t total_sec = court->duration_min * 60 + prep_sec;
  int32_t remaining = total_sec - elapsed;
  if (remaining < 0) remaining = 0;
  
  char time_buf[8];
  kiosk_format_time(time_buf, sizeof(time_buf), remaining);
  char big_buf[16];
  snprintf(big_buf, sizeof(big_buf), "%s %s", time_buf, phase == COURT_PHASE_PREPARING ? "PREP" : "LEFT");
  lv_label_set_text(label, big_buf);
  lv_obj_set_style_text_color(label, phase == COURT_PHASE_PREPARING ? KIOSK_COLOR_AMBER_400 : KIOSK_COLOR_EMERALD_400, 0);
}

static void sub_timer_refresh_cb(lv_event_t *e) {
  lv_obj_t *label = lv_event_get_target(e);
  uint8_t court_idx = (uint8_t)(uintptr_t)lv_event_get_user_data(e);
  
  kiosk_board_t board;
  kiosk_data_provider_get()->get_board(&board);
  if (court_idx >= board.court_count) return;
  const court_status_t *court = &board.courts[court_idx];
  
  if (!court_is_active(court)) return;
  
  int32_t elapsed = court_elapsed_sec(court);
  int32_t prep_sec = kiosk_effective_prep_sec(court->duration_min, court->prep_time_sec);
  court_phase_t phase = kiosk_phase_for_elapsed(elapsed, prep_sec);
  
  char sub_buf[64];
  if (phase == COURT_PHASE_PREPARING) {
    char prep_left[8];
    kiosk_format_time(prep_left, sizeof(prep_left), prep_sec - elapsed);
    snprintf(sub_buf, sizeof(sub_buf), "Game starts in %s", prep_left);
  } else {
    char elapsed_buf[8], game_buf[8];
    kiosk_format_time(elapsed_buf, sizeof(elapsed_buf), elapsed);
    kiosk_format_time(game_buf, sizeof(game_buf), elapsed - prep_sec);
    snprintf(sub_buf, sizeof(sub_buf), "Elapsed %s | Game %s", elapsed_buf, game_buf);
  }
  lv_label_set_text(label, sub_buf);
}

lv_obj_t *court_status_card_create(lv_obj_t *parent, const court_status_t *court, uint8_t court_idx) {
  lv_obj_t *card = lv_obj_create(parent);
  lv_obj_set_width(card, lv_pct(100));
  lv_obj_set_height(card, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(card, 8, 0);

  int32_t elapsed = court_elapsed_sec(court);
  court_phase_t phase = COURT_PHASE_AVAILABLE;
  int32_t prep_sec = kiosk_effective_prep_sec(court->duration_min, court->prep_time_sec);
  if (court_is_active(court)) {
    phase = kiosk_phase_for_elapsed(elapsed, prep_sec);
    lv_obj_add_style(card, phase == COURT_PHASE_PREPARING ? &kiosk_style_card_preparing
                                                           : &kiosk_style_card_in_game, 0);
  } else {
    lv_obj_add_style(card, &kiosk_style_card_available, 0);
  }

  /* Header row: name + status badge */
  lv_obj_t *header = lv_obj_create(card);
  lv_obj_remove_style_all(header);
  lv_obj_set_width(header, lv_pct(100));
  lv_obj_set_height(header, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(header, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(header, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  set_label(header, court->name, &lv_font_montserrat_16, KIOSK_COLOR_ZINC_100);

  if (court_is_active(court)) {
    set_label(header, phase == COURT_PHASE_PREPARING ? "Preparing" : "In Game", &lv_font_montserrat_14,
               phase == COURT_PHASE_PREPARING ? KIOSK_COLOR_AMBER_400 : KIOSK_COLOR_EMERALD_400);
  } else {
    set_label(header, "Available", &lv_font_montserrat_14, KIOSK_COLOR_EMERALD_400);
  }

  if (court->match_title[0] != '\0') {
    set_label(card, court->match_title, &lv_font_montserrat_14, KIOSK_COLOR_ZINC_400);
  }

  if (court_is_active(court)) {
    int32_t total_sec = court->duration_min * 60 + prep_sec;
    int32_t remaining = total_sec - elapsed;
    if (remaining < 0) remaining = 0;

    lv_obj_t *timer_box = lv_obj_create(card);
    lv_obj_remove_style_all(timer_box);
    lv_obj_set_width(timer_box, lv_pct(100));
    lv_obj_set_height(timer_box, LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(timer_box, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(timer_box, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_ver(timer_box, 8, 0);

    char time_buf[8];
    kiosk_format_time(time_buf, sizeof(time_buf), remaining);
    char big_buf[16];
    snprintf(big_buf, sizeof(big_buf), "%s %s", time_buf, phase == COURT_PHASE_PREPARING ? "PREP" : "LEFT");
    lv_obj_t *lbl_big = set_label(timer_box, big_buf, &lv_font_montserrat_32,
               phase == COURT_PHASE_PREPARING ? KIOSK_COLOR_AMBER_400 : KIOSK_COLOR_EMERALD_400);
    lv_obj_add_event_cb(lbl_big, big_timer_refresh_cb, LV_EVENT_REFRESH, (void *)(uintptr_t)court_idx);

    char sub_buf[64];
    if (phase == COURT_PHASE_PREPARING) {
      char prep_left[8];
      kiosk_format_time(prep_left, sizeof(prep_left), prep_sec - elapsed);
      snprintf(sub_buf, sizeof(sub_buf), "Game starts in %s", prep_left);
    } else {
      char elapsed_buf[8], game_buf[8];
      kiosk_format_time(elapsed_buf, sizeof(elapsed_buf), elapsed);
      kiosk_format_time(game_buf, sizeof(game_buf), elapsed - prep_sec);
      snprintf(sub_buf, sizeof(sub_buf), "Elapsed %s | Game %s", elapsed_buf, game_buf);
    }
    lv_obj_t *lbl_sub = set_label(timer_box, sub_buf, &lv_font_montserrat_14, KIOSK_COLOR_ZINC_500);
    lv_obj_add_event_cb(lbl_sub, sub_timer_refresh_cb, LV_EVENT_REFRESH, (void *)(uintptr_t)court_idx);

    if (court->player_count > 0) {
      lv_obj_t *chips = lv_obj_create(card);
      lv_obj_remove_style_all(chips);
      lv_obj_set_width(chips, lv_pct(100));
      lv_obj_set_height(chips, LV_SIZE_CONTENT);
      lv_obj_set_flex_flow(chips, LV_FLEX_FLOW_ROW_WRAP);
      lv_obj_set_style_pad_column(chips, 6, 0);

      uint8_t shown = court->player_count < 2 ? court->player_count : 2;
      for (uint8_t i = 0; i < shown; i++) {
        char name_buf[64];
        snprintf(name_buf, sizeof(name_buf), "%s %s", court->players[i].first_name, court->players[i].last_name);
        lv_obj_t *chip = lv_obj_create(chips);
        lv_obj_set_style_bg_color(chip, KIOSK_COLOR_ZINC_800, 0);
        lv_obj_set_style_bg_opa(chip, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(chip, 4, 0);
        lv_obj_set_style_pad_hor(chip, 8, 0);
        lv_obj_set_style_pad_ver(chip, 2, 0);
        lv_obj_set_style_border_width(chip, 0, 0);
        lv_obj_set_size(chip, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
        set_label(chip, name_buf, &lv_font_montserrat_14, KIOSK_COLOR_ZINC_300);
      }
      if (court->player_count > 2) {
        char more_buf[16];
        snprintf(more_buf, sizeof(more_buf), "+%d", court->player_count - 2);
        set_label(chips, more_buf, &lv_font_montserrat_14, KIOSK_COLOR_ZINC_500);
      }
    }
  }

  return card;
}
