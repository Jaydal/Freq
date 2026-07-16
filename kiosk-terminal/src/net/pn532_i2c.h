#pragma once

#ifdef __cplusplus
extern "C" {
#endif

void pn532_start_task(void);
#include <stdbool.h>
bool pn532_is_online(void);

#ifdef __cplusplus
}
#endif
