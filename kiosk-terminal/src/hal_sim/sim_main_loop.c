#include "sim_main_loop.h"
#include "sim_display.h"
#include "sim_input.h"
#include "lvgl.h"
#include "sdl/sdl.h"
#include <unistd.h>

void sim_hal_init(void) {
  sdl_init();
  sim_display_init();
  sim_input_init();
}

void sim_main_loop_run(void) {
  for (;;) {
    lv_timer_handler();
    usleep(5 * 1000);
  }
}
