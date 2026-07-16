# Freq Court Display — HD-WF2 Firmware

Self-contained firmware for the **Huidu HD-WF2** LED controller (ESP32-S3 + HUB75).

The HD-WF2 is a programmable ESP32-S3 board with a HUB75 connector, battery-backed RTC, and onboard status LED. We flash our own MQTT-driven firmware onto it — no Huidu proprietary protocol, no XiaoHui Cloud, no bridge needed.

## Target hardware

| Component | Value |
|---|---|
| Board | Huidu HD-WF2 (ESP32-S3, 4MB flash) |
| Panel | 2× P10 RGB, 32×16 each, 1/16 scan (ABCDE), chained **horizontal** → 64×16 |
| Connector | 75EX1 only (75EX2's E pin isn't wired on the S3 — see mrcodetastic/HD-WF1-WF2-LED-MatrixPanel-DMA) |
| Status LED | GPIO 40 (onboard RUN_LED) — solid = online, blink 500ms = WiFi/MQTT lost |
| Buzzer | none (no spare pin — 41/42 are RTC I2C) |
| Broker | HiveMQ Cloud mqtts://…:8883 (matches `web/.env.local`) |

## Pin map (75EX1)

| Signal | GPIO |   | Signal | GPIO |
|---|---|---|---|---|
| R1 | 2  |   | A  | 39 |
| G1 | 6  |   | B  | 38 |
| B1 | 10 |   | C  | 37 |
| R2 | 3  |   | D  | 36 |
| G2 | 7  |   | E  | 21 |
| B2 | 11 |   | LAT | 33 |
|   |    |   | OE  | 35 |
|   |    |   | CLK | 34 |

Source: `hd-wf2-esp32s3-config.h` from [mrcodetastic/HD-WF1-WF2-LED-MatrixPanel-DMA](https://github.com/mrcodetastic/HD-WF1-WF2-LED-MatrixPanel-DMA).

## Render model

Strictly matches `web/src/components/display/P10Display.tsx` horizontal layout:

- **2 visible rows** of 5×7 bitmap text (line1 y=0, line2 y=8, 1px gap).
- **line3 is dropped** (matches `P10Display.tsx:147` `slice(0, 2)`).
- **Short text** (≤ 64px): horizontal-centered static.
- **Long text** (> 64px): horizontal marquee scroll (left), 18ms tick, wrap when `x + width <= 0`, black `clearScreen` before each redraw.
- **Font**: 5×7 bitmap table identical to `P10Display.tsx:11-53` (A-Z, 0-9, space, `-`, `.`, `:`, `/`, nbsp). Lowercase auto-uppercased.

## MQTT contract

Unchanged from the rest of the project — `courts/{courtId}/display` retained QoS 1 with payload:

```json
{"line1":"COURT 1","line2":"12:34","line3":"RUNNING"}
```

`line3` is read by `MqttDisplayClient` and passed to the driver, but the WF2 driver ignores it. Drop-in compatible with the MAX7219 and 32-tall HUB75 vertical panels on the same broker.

## Build & flash

### Prerequisites

- PlatformIO CLI
- USB-A (host) → USB-C (WF2 programming port labelled "type C", on the 75EX1 side)
- A `wifi_config.h` in `src/` (copy from `wifi_config.h.example`)

## First-time setup (config portal)

No need to edit `wifi_config.h` or reflash to change settings. The WF2 has a **captive portal** — it starts as its own WiFi hotspot on first boot (or after factory reset), and you configure everything from your phone:

1. **Flash the firmware** (see Build & Flash below) — one-time only
2. **On first boot**, the WF2 starts in setup mode:
   - Panel shows `SETUP MODE / CONNECT TO / FREQ WIFI`
   - Status LED blinks rapidly (200ms)
   - A new WiFi network appears: `Freq-Setup-XXXX` (last 4 of MAC)
3. **Connect your phone/laptop** to `Freq-Setup-XXXX` (open, no password)
4. **A config page pops up automatically** (captive portal). If not, open `http://192.168.4.1` in a browser
5. **Fill the form**:
   - WiFi Network (dropdown of nearby networks + manual entry)
   - WiFi Password
   - MQTT Broker (pre-filled with your HiveMQ Cloud host)
   - MQTT Port / Username / Password
   - Court ID
6. **Tap "Save & Reboot"** → WF2 saves to flash (NVS), reboots, connects to your WiFi, starts normal operation

### Factory reset (field service)

If the WF2 is already configured but you need to change settings:
- **Long-press the onboard button (GPIO 17) for 5 seconds** → clears NVS → reboots into setup mode → portal appears again

### When portal mode activates

| Situation | What happens |
|---|---|
| First boot (NVS empty) | Portal starts automatically |
| WiFi fails 3× after config | Falls back to portal |
| Long-press button 5s | Factory reset → portal |
| Normal operation | Portal stays off; settings persist across reboots |

## Build & flash

### Prerequisites

- PlatformIO CLI
- USB-A (host) → USB-C (WF2 programming port labelled "type C", on the 75EX1 side)

### Build

```bash
pio run -e esp32-hub75-wf2
```

Expected: `========================= [SUCCESS] =========================`

### Flash (one-time)

```bash
pio run -e esp32-hub75-wf2 -t upload --upload-port /dev/cu.usbmodem*
```

After the first flash, all configuration is done via the portal — no reflash needed.

### Monitor (debug)

```bash
pio device monitor -e esp32-hub75-wf2 --port /dev/cu.usbmodem*
```

**Portal mode boot:**
```
=== Freq Court Display — HD-WF2 ===
[main] No settings in NVS → starting config portal
[portal] Starting AP: Freq-Setup-A1B2
[portal] Portal active at http://192.168.4.1
```

**Normal boot (after portal config):**
```
=== Freq Court Display — HD-WF2 ===
[portal] Connecting to saved WiFi: MyVenueWiFi
[portal] WiFi OK  IP=192.168.1.42
[health] Connecting MQTT  broker=...:8883  id=court-1
[health] MQTT OK  topic=courts/court-1/display
```

## File layout

```
firmware/hdwf2/
├── platformio.ini            # env:esp32-hub75-wf2
├── README.md                  # this file
└── src/
    ├── main.cpp               # boot branching: portal vs normal, button reset, MQTT loop
    ├── ConfigPortal.h         # captive portal AP + NVS storage interface
    ├── ConfigPortal.cpp       # AP mode, web form, DNS redirect, NVS read/write
    ├── IDisplayDriver.h       # shared interface (with setBrightness no-op)
    ├── Hub75Driver.h          # WF2 driver declaration
    ├── Hub75Driver.cpp        # WF2 pins + 64×16 geometry + 5×7 font + marquee
    ├── MqttDisplayClient.h    # shared MQTT client (copied from firmware/src)
    ├── MqttDisplayClient.cpp  # shared MQTT client (copied from firmware/src)
    ├── wifi_config.h.example  # legacy compile-time fallback (portal is primary)
```

## Notes on shared files

`IDisplayDriver.h`, `MqttDisplayClient.h`, and `MqttDisplayClient.cpp` are copied from `firmware/src/`. They're stable because the MQTT contract (`courts/{courtId}/display` → `{line1,line2,line3}`) is locked for Phase 1. If the contract changes (e.g. brightness is added in Phase 2), update both copies — or refactor into `firmware/lib/Shared/` as a real PIO library.

## Phase 2 (deferred)

- Add `brightness`, `scrollSpeedMs`, `color` to the MQTT payload (backward-compatible via ArduinoJson's tolerant parsing).
- Add a `display_settings` column to the `courts` table and an admin editor in `web/src/features/settings/`.
- `IDisplayDriver::setBrightness(uint8_t)` virtual is already in place; `Hub75Driver` already implements it.

## Acknowledgments

Pin map and `i2sspeed`/`latch_blanking` defaults derived from the proof-of-concept firmware at https://github.com/mrcodetastic/HD-WF1-WF2-LED-MatrixPanel-DMA.

## Troubleshooting / Known ESP32-S3 Issues

During development, several deep hardware/core issues were encountered and resolved on the HD-WF2 (and generic ESP32-S3 boards), including:
1. Hard Freeze on Boot (DMA / WiFi Conflict)
2. Silent Logs / Blind Booting (UART0 vs USB-CDC)
3. Settings Not Saving / NVS Wiped on Reboot (Flash Mode QIO vs DIO)

For a detailed breakdown of these bugs and their solutions, please see [ESP32-S3 Hardware Bugs](../../docs/ESP32_S3_Hardware_Bugs.md).