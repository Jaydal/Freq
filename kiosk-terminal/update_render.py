import re

with open('src/ui/ui_app.c', 'r') as f:
    content = f.read()

new_render = """static void render_current(void) {
  static kiosk_board_t board;

  lv_obj_t *scr = lv_scr_act();
  char member_name[64];

  bool needs_terminal = (s_app.step == KIOSK_STEP_EXISTING_QUEUE ||
                         s_app.step == KIOSK_STEP_SELECT_COURT ||
                         s_app.step == KIOSK_STEP_SELECT_GAME ||
                         s_app.step == KIOSK_STEP_SELECT_DURATION ||
                         s_app.step == KIOSK_STEP_CONFIRM ||
                         s_app.step == KIOSK_STEP_SUCCESS ||
                         s_app.step == KIOSK_STEP_ERROR);

  if (needs_terminal) {
    if (!s_app.has_terminal_layout) {
      if (s_app.current_root) {
        lv_obj_del(s_app.current_root);
        s_app.current_root = NULL;
      }
      s_app.terminal_layout = terminal_layout_create(scr);
      s_app.current_root = s_app.terminal_layout.root;
      s_app.has_terminal_layout = true;
    } else {
      lv_obj_clean(s_app.terminal_layout.content);
      lv_obj_clean(s_app.terminal_layout.sidebar);
    }
  } else {
    if (s_app.current_root) {
      lv_obj_del(s_app.current_root);
      s_app.current_root = NULL;
    }
    s_app.has_terminal_layout = false;
  }

  switch (s_app.step) {
    case KIOSK_STEP_SETUP: {
      s_app.current_root = setup_screen_create(scr, handle_setup_done, NULL);
      break;
    }
    case KIOSK_STEP_BOOTING: {
      s_app.current_root = build_booting_screen(scr);
      break;
    }
    case KIOSK_STEP_IDLE: {
      s_app.provider->get_board(&board);
      s_app.current_root = queue_board_create(scr, &board, handle_scan, NULL);
      lv_obj_t *corner = lv_obj_create(s_app.current_root);
      lv_obj_remove_style_all(corner);
      lv_obj_set_size(corner, 60, 60);
      lv_obj_align(corner, LV_ALIGN_TOP_LEFT, 0, 0);
      lv_obj_add_flag(corner, LV_OBJ_FLAG_CLICKABLE);
      lv_obj_add_event_cb(corner, idle_long_press_cb, LV_EVENT_LONG_PRESSED, NULL);
      break;
    }
    case KIOSK_STEP_EXISTING_QUEUE: {
      terminal_layout_set_sidebar(&s_app.terminal_layout, true);
      build_existing_queue_screen(s_app.terminal_layout.content);
      s_app.provider->get_board(&board);
      court_overview_create(s_app.terminal_layout.sidebar, board.courts, board.court_count);
      break;
    }
    case KIOSK_STEP_SELECT_COURT: {
      terminal_layout_set_sidebar(&s_app.terminal_layout, true);
      court_option_t options[KIOSK_MAX_COURTS];
      uint8_t count = 0;
      s_app.provider->get_court_options(options, &count);
      format_member_name(member_name, sizeof(member_name));
      step_select_court_create(s_app.terminal_layout.content,
                                member_name, s_app.member.balance,
                                options, count,
                                handle_select_court,
                                close_to_idle, NULL, NULL);
      s_app.provider->get_board(&board);
      court_overview_create(s_app.terminal_layout.sidebar, board.courts, board.court_count);
      break;
    }
    case KIOSK_STEP_SELECT_GAME: {
      terminal_layout_set_sidebar(&s_app.terminal_layout, true);
      format_member_name(member_name, sizeof(member_name));
      step_select_game_type_create(s_app.terminal_layout.content,
                                    member_name, s_app.member.balance,
                                    handle_select_game_type,
                                    close_to_idle, NULL,
                                    handle_back_step, NULL, NULL);
      s_app.provider->get_board(&board);
      court_overview_create(s_app.terminal_layout.sidebar, board.courts, board.court_count);
      break;
    }
    case KIOSK_STEP_SELECT_DURATION: {
      terminal_layout_set_sidebar(&s_app.terminal_layout, true);
      kiosk_products_config_t cfg;
      s_app.provider->get_products_config(&cfg);
      format_member_name(member_name, sizeof(member_name));
      step_select_duration_create(s_app.terminal_layout.content,
                                   member_name, s_app.member.balance,
                                   &cfg,
                                   handle_select_duration,
                                   close_to_idle, NULL,
                                   handle_back_step, NULL, NULL);
      s_app.provider->get_board(&board);
      court_overview_create(s_app.terminal_layout.sidebar, board.courts, board.court_count);
      break;
    }
    case KIOSK_STEP_CONFIRM: {
      terminal_layout_set_sidebar(&s_app.terminal_layout, false);
      kiosk_products_config_t cfg;
      s_app.provider->get_products_config(&cfg);
      int32_t party_size = (s_app.game_type == GAME_TYPE_2V2) ? 4 : 2;
      int32_t credits_required = kiosk_get_cost(&cfg, s_app.duration_min, party_size);
      const char *game_label = (s_app.game_type == GAME_TYPE_2V2) ? "Doubles (2v2)" : "Singles (1v1)";
      format_member_name(member_name, sizeof(member_name));
      step_booking_confirm_create(s_app.terminal_layout.content,
                                   member_name, s_app.member.balance,
                                   s_app.selected_court.name,
                                   game_label,
                                   s_app.duration_min,
                                   credits_required,
                                   handle_confirm,
                                   close_to_idle, NULL,
                                   handle_back_step, NULL, NULL);
      break;
    }
    case KIOSK_STEP_SUCCESS: {
      terminal_layout_set_sidebar(&s_app.terminal_layout, false);
      step_booking_success_create(s_app.terminal_layout.content, &s_app.result);
      break;
    }
    case KIOSK_STEP_ERROR: {
      terminal_layout_set_sidebar(&s_app.terminal_layout, false);
      step_error_create(s_app.terminal_layout.content, &s_app.error, handle_error_retry, NULL);
      break;
    }
  }
}"""

# regex to replace render_current function
pattern = re.compile(r'static void render_current\(void\) \{.*?(?=\n/\* ---- periodic refresh ---- \*/)', re.DOTALL)
new_content = pattern.sub(new_render + '\n', content)

with open('src/ui/ui_app.c', 'w') as f:
    f.write(new_content)
