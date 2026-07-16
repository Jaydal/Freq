#include "sim_input.h"
#include "lvgl.h"
#include "sdl/sdl.h"

static lv_indev_drv_t s_indev_drv;

void sim_input_init(void) {
  lv_indev_drv_init(&s_indev_drv);
  s_indev_drv.type = LV_INDEV_TYPE_POINTER;
  s_indev_drv.read_cb = sdl_mouse_read;
  lv_indev_drv_register(&s_indev_drv);
}
