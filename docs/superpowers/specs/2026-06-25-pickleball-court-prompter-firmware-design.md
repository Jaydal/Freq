# Pickleball Court Prompter Firmware — MVP Design

## Overview

Firmware for a Pickleball Court Prompter running on ESP32 + MAX7219 8x32 LED matrix. MVP phase focuses purely on display rendering using mock data — no WiFi, WebSocket, or backend integration.

## Scope (MVP)

- MAX7219 8x32 LED matrix displaying scrolling/text content
- MockDataProvider that cycles through sample screens
- DisplayManager that reads mock state and renders to matrix
- LedController + Buzzer for basic status indication
- Runs on Wokwi simulation

Deferred (post-MVP): WiFi, WebSocket, config portal, HUB75 hardware support.

## Architecture

```
main.cpp
  └── MockDataProvider ──┐
                          ├── DisplayManager ── MAX7219 matrix
  └── LedController  ──── GPIO 25 (green), GPIO 26 (red)
  └── Buzzer         ──── GPIO 27
```

The data source is abstracted behind `IDataProvider` so the real backend can slot in later without changing display logic.

## Interfaces

### IDataProvider

```cpp
class IDataProvider {
public:
  virtual DisplayState getCurrentState() = 0;
};

struct DisplayState {
  String status;           // IDLE, PREPARING, RUNNING, COOLDOWN, MAINTENANCE, OFFLINE
  int courtNumber;
  String matchType;
  String team1[4];
  String team2[4];
  int team1Count;
  int team2Count;
  String remainingTime;
  String queuePlayers[8];
  int queuePlayerCount;
  String nextPlayers[8];
  int nextPlayerCount;
};
```

### IDisplayDriver (internal to DisplayManager)

```cpp
class IDisplayDriver {
public:
  virtual void begin() = 0;
  virtual void clear() = 0;
  virtual void showText(const char* text, int zone = 0) = 0;
  virtual void setIntensity(int level) = 0;
  virtual bool displayAnimate() = 0;
};
```

Two implementations: `Max7219Driver` (Wokwi MVP) and `Hub75Driver` (future real hardware).

## Project Structure

```
Freq/
├── platformio.ini
├── src/
│   ├── main.cpp
│   ├── DisplayManager.cpp
│   ├── DisplayManager.h
│   ├── LedController.cpp
│   ├── LedController.h
│   ├── Buzzer.cpp
│   ├── Buzzer.h
│   ├── IDataProvider.h
│   ├── MockDataProvider.cpp
│   └── MockDataProvider.h
└── docs/superpowers/specs/
    └── 2026-06-25-pickleball-court-prompter-firmware-design.md
```

## Mock Scenarios & Timing

| Scenario   | Duration | Display Content                     | Green LED | Red LED | Buzzer    |
|------------|----------|-------------------------------------|-----------|---------|-----------|
| Idle       | 5s       | "WELCOME PICKLEBALL COURT ..."      | off       | off     | off       |
| Queue      | 8s       | "NOW PLAYING C1 JUAN/PEDRO VS ..."  | off       | off     | off       |
| Preparing  | 10s      | "COURT 1 PREPARING 02:00"           | on        | off     | short     |
| Running    | 30s      | "COURT 1 2V2 59:42" (countdown)    | off       | on      | off       |
| Cooldown   | 5s       | "GAME FINISHED NEXT MATCH 05:00"    | off       | off     | off       |
| Maintenance| 5s       | "COURT CLOSED MAINTENANCE"          | blink     | off     | off       |
| Offline    | 5s       | "SERVER OFFLINE RECONNECTING..."    | off       | blink   | off       |

## GPIO Pinout

| Component       | Pin     |
|-----------------|---------|
| MAX7219 DIN     | GPIO 23 |
| MAX7219 CS      | GPIO 5  |
| MAX7219 CLK     | GPIO 18 |
| Green LED       | GPIO 25 |
| Red LED         | GPIO 26 |
| Buzzer          | GPIO 27 |

## Libraries

- `LedControl` — MAX7219 driver
- `MD_Parola` — text scrolling/fx library on top of MAX7219
- `MD_MAX72XX` — low-level MAX7219 control (dependency of MD_Parola)
- `Arduino` framework (built-in)

## PlatformIO Configuration

Single environment `esp32-wokwi` for MVP:

```ini
[env:esp32-wokwi]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    md_Parola
    md_MAX72XX
build_flags =
    -D WOKWI_SIMULATION
    -D MOCK_DATA
```

## Code Quality

- No global mutable state (all instances created in `main.cpp`, passed via reference)
- No blocking `delay()` — all timing via `millis()`
- RAII for hardware init
- Const correctness
- Single Responsibility: each class owns one concern

## Transition to Real Backend

When the Management Portal is ready:
1. Implement `WebSocketDataProvider : IDataProvider`
2. Add `WifiManager` and `WebSocketClient` classes
3. Swap `MockDataProvider` for `WebSocketDataProvider` in `main.cpp`
4. No changes to `DisplayManager`, `LedController`, or `Buzzer`

## Wokwi Simulation

- `wokwi.toml` configured for ESP32 DevKit V1
- `diagram.json` includes ESP32 + MAX7219 8x32 matrix + 2 LEDs + buzzer
- Build with `pio run -e esp32-wokwi`
- Run with `wokwi-cli .`
