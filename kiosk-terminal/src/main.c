#include "lvgl.h"
#include "hal_sim/sim_main_loop.h"
#include "net/mqtt_transport.h"
#include "ui/ui_app.h"
#include <string.h>

/* Pumps the MQTT client from the UI thread so its message callback runs
 * single-threaded with LVGL (no locking). No-op when MQTT isn't started
 * (e.g. --mock or no broker configured). */
static void mqtt_poll_cb(lv_timer_t *t) {
  (void)t;
  mqtt_transport_poll();
}

int main(int argc, char **argv) {
  (void)argc;
  (void)argv;

  lv_init();
  sim_hal_init();
  ui_app_init();
  lv_timer_create(mqtt_poll_cb, 50, NULL);
  sim_main_loop_run();
  return 0;
}
