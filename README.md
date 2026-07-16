# Pickleball Court Prompter — Firmware (MVP)

ESP32 firmware that drives a MAX7219 8×32 LED matrix to display real-time pickleball court status. MVP phase uses mock data cycling through all display states. No WiFi or backend required to run.

Simulated in [Wokwi](https://wokwi.com) via `wokwi-cli`.

> **Note:** As of the latest architecture updates, local Mosquitto instances and local PostgreSQL databases are strictly **obsolete**. All hardware and web clients must connect exclusively to **HiveMQ Cloud** for MQTT and **Supabase** for database/realtime services.

---

## Hardware

| Component | Part | Wokwi type |
|---|---|---|
| MCU | ESP32 DevKit V1 | `wokwi-esp32-devkit-v1` |
| Matrix | 4× MAX7219 8×8 LED modules (32×8 total) | `wokwi-max7219-matrix` |
| Green LED | Status indicator | `wokwi-led` (green) |
| Red LED | Status indicator | `wokwi-led` (red) |
| Buzzer | Audio alert | `wokwi-buzzer` |

### Pin mapping

| Signal | ESP32 pin |
|---|---|
| MAX7219 DIN (MOSI) | GPIO 23 |
| MAX7219 CLK | GPIO 18 |
| MAX7219 CS | GPIO 5 |
| Green LED | GPIO 25 |
| Red LED | GPIO 26 |
| Buzzer | GPIO 27 |

### Matrix wiring

The four 8×8 modules are daisy-chained left to right:

```
ESP32 D23 → mx1 DIN → mx2 DIN → mx3 DIN → mx4 DIN
ESP32 D18 → CLK (shared)
ESP32 D5  → CS  (shared)
```

mx1 is the leftmost module; mx4 is the rightmost.

#### Hardware type note

The firmware uses `MD_MAX72XX::PAROLA_HW` for the matrix hardware type. This was determined empirically with Wokwi's `wokwi-max7219-matrix` component:

- `FC16_HW` produces mirrored text (columns reversed within each module)
- `PAROLA_HW` is identical to `FC16_HW` but adds column reversal (`_hwRevCols=true`), which corrects the mirroring

No zone flip effects (`PA_FLIP_LR`) are needed. With the daisy-chain above, SPI offset math places device 0 at mx1 (leftmost), so text naturally flows left to right.

---

## Display states

The MockDataProvider cycles through these scenarios every loop:

| State | Duration | Matrix display | Green LED | Red LED | Buzzer |
|---|---|---|---|---|---|
| IDLE | 8 s | `WELCOME PICKLEBALL COURT` (scroll) | off | off | — |
| QUEUE | 10 s | `NOW PLAYING C1 2V2 JUAN/PEDRO VS MARK/JAMES` (scroll) | off | off | — |
| PREPARING | 12 s | `PREP 02:00` (static, countdown) | on | off | short beep on entry |
| RUNNING | 30 s | `30:00` (static, countdown) | off | on | — |
| COOLDOWN | 8 s | `DONE 05:00` (static, countdown) | off | off | — |
| MAINTENANCE | 6 s | `CLOSED` (static) | blink | off | — |
| OFFLINE | 6 s | `OFFLINE` (static) | off | blink | — |

---

## Architecture

```
main.cpp
├── MockDataProvider   cycles through DisplayState scenarios
├── DisplayManager     renders DisplayState to the MAX7219 matrix
├── LedController      drives green/red LEDs (on / off / blink)
└── Buzzer             non-blocking tone generation
```

All timing uses `millis()`. No `delay()` anywhere.

`DisplayManager` polls `IDataProvider::getCurrentState()` each loop tick. On status change it re-renders immediately; on animation completion it re-renders to keep countdowns live.

### Extensibility

`IDataProvider` is a pure interface. Swapping mock data for a real backend requires only implementing `WebSocketDataProvider : IDataProvider` and changing the one `new MockDataProvider()` line in `main.cpp`.

---

## Build & run

### Prerequisites

- [PlatformIO](https://platformio.org) CLI or IDE extension
- [wokwi-cli](https://github.com/wokwi/wokwi-cli) with a valid `WOKWI_CLI_TOKEN`

### Build

```bash
pio run -e esp32-wokwi
```

### Simulate

```bash
export WOKWI_CLI_TOKEN="<your token>"
wokwi-cli . --timeout 120000
```

---

## Project structure

```
Freq/
├── platformio.ini
├── diagram.json          Wokwi circuit diagram
├── wokwi.toml            Wokwi simulator config
├── src/
│   ├── main.cpp
│   ├── IDataProvider.h   DisplayState struct + IDataProvider interface
│   ├── MockDataProvider.h / .cpp
│   ├── DisplayManager.h / .cpp
│   ├── LedController.h / .cpp
│   └── Buzzer.h / .cpp
└── docs/
    └── superpowers/
        ├── specs/        Original firmware design spec
        └── plans/        Implementation plan
```

## Libraries

| Library | Purpose |
|---|---|
| `MD_Parola` | Text animation (scroll, print, effects) |
| `MD_MAX72XX` | Low-level MAX7219 driver |
