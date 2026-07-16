# Kiosk Terminal — LVGL

Touchscreen kiosk UI for the pickleball court booking system, targeting an
ESP32-S3 with an LCD + capacitive touch panel. This repo starts as a **PC
simulator** (LVGL v8.2 + SDL2) for fast UI iteration; the real hardware
target is a later phase.

The UI mirrors the web terminal (`web/src/components/terminal/*`): a live
queue board (court status cards, "now serving" offer, waiting queue) plus an
RFID-triggered booking flow (select court → game type → duration → confirm →
success / offer / error), and a first-boot WiFi setup screen.

## Build & run (macOS / Linux)

Prerequisites: `cmake`, a C compiler, and SDL2 (`brew install sdl2` on macOS).

```bash
cmake -B build -S .
cmake --build build -j
./build/kiosk_sim
```

A 1024×600 window opens. LVGL and lv_drivers are fetched automatically by
CMake (`FetchContent`) — no submodules.

## Using the simulator

- **First launch** shows the **WiFi Setup** screen (no saved config yet).
  Tap a field, type with the on-screen keyboard, tap **Save & Continue**.
  Config is written to `kiosk_config.ini` (a stand-in for ESP32 NVS flash).
- After setup, the **idle queue board** shows. The top-right **T1–T5**
  buttons simulate RFID card taps (no real reader exists yet):
  - **T1** Juan (has credits) → full booking flow
  - **T2** Maria (low credits) → insufficient-credits path
  - **T3** Pedro → jumps straight to a reservation **offer**
  - **T4** Ana → **existing booking** screen
  - **T5** Jose → **already playing** error
- **Long-press the top-left corner** of the idle screen to re-open WiFi setup.

## Architecture

A hard boundary keeps the UI portable to real hardware:

- `src/ui/` — LVGL screens/widgets. Pure LVGL C, no SDL/hardware refs.
  Reused unchanged on the ESP32-S3.
- `src/data/` — portable model + provider/config **interfaces**
  (`kiosk_data_provider.h`, `kiosk_config.h`).
- `src/data/mock/` — the only data source for now: static mock courts/queue
  with self-advancing timers. Later replaced by an HTTP/MQTT provider
  implementing the same interface.
- `src/hal_sim/` — SDL2 display/input glue + file-based config store.
  Replaced by `src/hal_esp32/` (real LCD/touch driver + NVS) on hardware;
  nothing in `ui/` or `data/` changes.

## Not yet implemented (future phases)

- ESP32-S3 build target (PlatformIO/ESP-IDF), real LCD + touch driver.
- Real networking: WiFi association, and swapping the mock provider for the
  live backend (`/api/queue`, `/api/courts/status`, RFID lookup).
- Real RFID reader input (the T1–T5 buttons are placeholders).

## Hardware Wiring (Waveshare ESP32-S3-Touch-LCD-7B)

The NFC reader (PN532) connects via I2C, but **cannot** use the board's I2C header due to a hardcoded address conflict (`0x24`) with the internal screen controller. 

Instead, the NFC reader is routed to the **UART2** header on the back of the board, which connects to `GPIO 43` and `GPIO 44`.

### Wiring Instructions:
1. **Physical Switch**: You MUST flip the DIP switch on the board (labeled `UART selection: UART1 or UART2`) to **UART2**. If you leave it on UART1, the pins are hijacked by the USB port.
2. **USB Port**: Since the UART Type-C port is now disabled by the switch, you must plug your USB-C cable into the **"USB"** Type-C port (Native USB) for flashing and serial monitor.
3. **NFC Connection**: 
   - `SDA` -> `UART2 TX` (Pin 43)
   - `SCL` -> `UART2 RX` (Pin 44)
   - `VCC` -> `5V`
   - `GND` -> `GND`
