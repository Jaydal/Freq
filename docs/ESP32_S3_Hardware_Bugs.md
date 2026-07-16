# ESP32-S3 Hardware Troubleshooting

During the development of the Freq Court Display firmware (`firmware/hdwf2`) for the Huidu HD-WF2 (and generic ESP32-S3 boards), several deep hardware and core-level issues were encountered.

If you adapt this firmware or build a custom ESP32-S3 project, keep these known issues in mind.

---

### 1. Hard Freeze on Boot (DMA / WiFi Conflict)
**Symptom:** The board freezes silently immediately after `setupDMA()` is called, or the serial monitor halts completely without a panic.
**Cause:** The ESP32 Arduino Core automatically starts a background WiFi auto-reconnect task on boot. If this background network task runs *while* the I2S DMA engine is allocating contiguous memory and configuring the peripheral, the hardware locks up.
**Solution:** Explicitly call `WiFi.mode(WIFI_OFF);` and `delay(100);` at the very top of `setup()` to kill the background task *before* calling `displayDriver->begin()`.

---

### 2. Silent Logs / Blind Booting
**Symptom:** You flash the board via the USB-C port, but the PlatformIO Serial Monitor stays completely blank after `entry 0x403c98d0`.
**Cause:** Standard `Serial.print()` on many ESP32-S3 configurations routes to `UART0` (the physical TX/RX pins) instead of the Native USB-C CDC interface.
**Solution:** Use the ESP-IDF logging macros (`log_i()`, `log_e()`) instead of `Serial.print()`. Ensure `build_flags = -D CORE_DEBUG_LEVEL=3` is set in `platformio.ini`. The core correctly routes `log_i` output to the USB CDC port.

---

### 3. Settings Not Saving / NVS Wiped on Reboot / LittleFS Format Fails
**Symptom:** The Captive Portal successfully says "Config SAVED", but on the next reboot, the ESP32 says `nvs_get_str len fail: wifi_ssid NOT_FOUND` and launches the portal again. Attempting to use `LittleFS` fails with formatting errors.
**Cause:** `platformio.ini` flash mode was set to `board_build.flash_mode = qio` (Quad I/O). Many generic ESP32-S3 boards (like the HD-WF2) only support `dio` (Dual I/O) due to physical pin wiring or lacking Quad-SPI flash chips. With `qio`, the bootloader successfully reads the app to boot via standard SPI, but all SPI *writes* (to NVS or LittleFS) silently corrupt or fail.
**Solution:** Change `board_build.flash_mode = dio` in `platformio.ini`. Settings will instantly begin persisting.
