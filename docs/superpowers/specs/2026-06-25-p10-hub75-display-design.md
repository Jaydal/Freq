# P10 HUB75 Display Support — Design Spec

## Context

The MVP used a MAX7219 8×32 LED matrix (Wokwi simulation). For outdoor court-side deployment, a P10 HUB75 LED panel is required: brighter, larger, and readable at 10–15 m. This spec covers adding HUB75 support while keeping the MAX7219 simulation working for development.

## Requirements

- Drive a 4×2 P10 HUB75 panel (128×32 pixels) with 3 rows of text
- Keep the MAX7219 Wokwi simulation functional for dev/CI
- No changes to `MockDataProvider`, `LedController`, `Buzzer`, or `IDataProvider`
- All timing remains `millis()`-based, no blocking

## Architecture

```
DisplayManager
    └── IDisplayDriver  (interface)
            ├── Max7219Driver   → MD_Parola / MAX7219 (Wokwi sim)
            └── Hub75Driver     → ESP32-HUB75-MatrixPanel-I2S-DMA (P10 hardware)
```

`main.cpp` selects the driver at compile time via `-D USE_HUB75` or `-D USE_MAX7219`.
`DisplayManager` is fully display-agnostic — it only calls `IDisplayDriver`.

## IDisplayDriver Interface

```cpp
class IDisplayDriver {
public:
  virtual void begin() = 0;
  virtual void clear() = 0;
  virtual void showRow(uint8_t row, const char* text) = 0;  // row: 0 (top) .. 2 (bottom)
  virtual void update() = 0;
  virtual ~IDisplayDriver() = default;
};
```

## 3-Row Layout (Approach A — equal rows, every state)

All states use the same 3-row structure. Row 1 (middle) always carries the primary info so the MAX7219 driver can show it on the single-row display.

| State       | Row 0          | Row 1 (primary)   | Row 2          |
|-------------|----------------|-------------------|----------------|
| IDLE        | WELCOME        | PICKLEBALL        | COURT          |
| QUEUE       | C{N} {type}    | {team1 names}     | VS {team2}     |
| PREPARING   | COURT {N}      | {time}            | PREPARING      |
| RUNNING     | C{N} {type}    | {time}            | RUNNING        |
| COOLDOWN    | GAME DONE      | {time}            | NEXT MATCH     |
| MAINTENANCE | COURT CLOSED   | MAINTENANCE       |                |
| OFFLINE     | SERVER         | OFFLINE           | RECONNECT...   |

## Hub75Driver

- Library: `ESP32-HUB75-MatrixPanel-I2S-DMA` + `Adafruit GFX`
- Panel: 128×32, 1 chain, 1/16 scan (no E pin)
- Row Y positions: 1 / 12 / 23 (8px font, 3px gap)
- Text: white, centered via `getTextBounds`
- DMA-driven — `update()` is a no-op

### HUB75 Pin Map

| Signal | GPIO |
|---|---|
| R1 | 25 |
| G1 | 26 |
| B1 | 27 |
| R2 | 14 |
| G2 | 12 |
| B2 | 13 |
| A  | 23 |
| B  | 22 |
| C  | 5  |
| D  | 17 |
| CLK | 16 |
| LAT | 4  |
| OE  | 15 |

GPIO 25/26/27 are used by HUB75 color data, so LED and buzzer pins shift:

| Component  | HUB75 env | MAX7219 env |
|---|---|---|
| Green LED  | GPIO 32   | GPIO 25     |
| Red LED    | GPIO 33   | GPIO 26     |
| Buzzer     | GPIO 21   | GPIO 27     |

## Max7219Driver

- Wraps existing MD_Parola / PAROLA_HW setup
- Only renders row 1 (primary info); rows 0 and 2 are ignored
- Short text (≤ 5 chars): static centered with 500 ms pause
- Long text (> 5 chars): left-scroll

## DisplayManager Update Logic

- Status change → immediate re-render
- Time-based states (RUNNING, COOLDOWN, PREPARING) → re-render every 1000 ms to update countdown
- Other states → no re-render until status changes
- Calls `_driver.update()` every loop tick for animation-driven drivers (MAX7219)

## PlatformIO Environments

| Env | Driver | Wokwi sim |
|---|---|---|
| `esp32-wokwi` | Max7219Driver | `diagram.json` (4× MAX7219) |
| `esp32-hub75` | Hub75Driver | `diagram-hub75.json` (future) |

## Wokwi Simulation

Wokwi does not have a built-in HUB75 panel component, and the I2S DMA peripheral used by ESP32-HUB75-MatrixPanel-I2S-DMA is not simulated. The `esp32-wokwi` environment (MAX7219) remains the primary simulation target. The `esp32-hub75` environment is build-verified only — hardware testing required for HUB75.

## Out of Scope

- Color per state (future enhancement)
- Scrolling long text on HUB75 (future enhancement)
- Score display
- WiFi / WebSocket data provider
