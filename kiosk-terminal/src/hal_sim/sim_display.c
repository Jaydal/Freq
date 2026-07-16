#include "sim_display.h"
#include "lvgl.h"
#include "sdl/sdl.h"
#include "lv_drv_conf.h"

static lv_disp_draw_buf_t s_draw_buf;
static lv_color_t s_buf[SDL_HOR_RES * SDL_VER_RES];
static lv_disp_drv_t s_disp_drv;

void sim_display_init(void) {
  lv_disp_draw_buf_init(&s_draw_buf, s_buf, NULL, SDL_HOR_RES * SDL_VER_RES);

  lv_disp_drv_init(&s_disp_drv);
  s_disp_drv.draw_buf = &s_draw_buf;
  s_disp_drv.flush_cb = sdl_display_flush;
  s_disp_drv.hor_res = SDL_HOR_RES;
  s_disp_drv.ver_res = SDL_VER_RES;
  lv_disp_drv_register(&s_disp_drv);
}
