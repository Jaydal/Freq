# Freq — Pickleball Court Management System

Monorepo for a commercial pickleball court management system following a **Smart Server / Thin Client** architecture. The Next.js server handles all business logic; the hardware clients are stateless displays and kiosks.

```
Freq/
├── web/                Next.js full-stack application
├── display-firmware/   ESP32-S3 LED scoreboard (Hub75 DMA)
├── kiosk-terminal/     ESP32-S3 LVGL touchscreen kiosk
├── docs/               Hardware bugs, specs, plans
└── AGENTS.md           AI agent instructions
```

## Projects

### `web/` — Next.js Server

The central brain. Tech: Next.js (App Router), Supabase (PostgreSQL + Realtime), TailwindCSS, TypeScript.

- **Queue Processor:** Server-side background worker that advances the queue, handles timers, auto-books available courts
- **Admin Dashboard:** Court/game/member/wallet management, drag-and-drop queue reorder, court reassignment
- **Web Kiosk:** Touch-friendly terminal UI with SSE real-time updates
- **MQTT Publisher:** Sends `display.pages[]` payloads to `courts/<courtId>/display` for LED scoreboards
- **Board Publisher:** Sends queue state to `freq/board` for physical kiosk terminal

```bash
cd web && npm run dev
```

### `display-firmware/` — LED Scoreboard

Hardware: [Huidu HD-WF2](https://www.huidu.com/product/7137845807125983) (ESP32-S3) driving 2× [P10 RGB LED Matrix Panels](https://www.aliexpress.com/w/wholesale-p10-rgb-led-matrix-panel.html) (Hub75, 64×32px total). "Dumb" display client — subscribes to MQTT and renders playlist pages with local rotation timing.

```bash
cd display-firmware && pio run -e esp32-hub75-wf2
```

### `kiosk-terminal/` — Touchscreen Kiosk

Hardware: [ESP32-S3 RGB LCD board](https://www.waveshare.com/esp32-s3-touch-lcd-7.htm) (Waveshare 7" or similar) with [PN532 NFC/RFID reader](https://www.elechouse.com/product/pn532-nfc-rfid-module-v4/). LVGL UI that scans RFID cards, lets users select court/game/duration, and joins the queue via REST API. Receives live queue state via MQTT (`freq/board`).

```bash
cd kiosk-terminal && cmake -B build -S . && cmake --build build -j && ./build/kiosk_sim
```

## Architecture

- **Single Source of Truth:** Supabase — all state lives here
- **Cloud Infrastructure:** HiveMQ Cloud for MQTT, Supabase for DB/realtime
- **No Local Brokers:** Local Mosquitto/PostgreSQL are obsolete
- **No Offer Timer:** Queue auto-books immediately when court available; no confirmation timer
- **Real-time SSE:** Web terminal pages use SSE instead of polling

## MQTT Topics

| Topic | Direction | Payload | Description |
|---|---|---|---|
| `courts/{courtId}/display` | Server → Display | `{display:{pages:[{text,color,effect,durationSeconds}]}}` | LED scoreboard content |
| `courts/{courtId}/status` | Display → Server | `{status,ip,rssi,court}` | Display health heartbeat |
| `freq/board` | Server → Kiosk | `BoardSnapshot` JSON | Live queue + court state |

## Infrastructure

- **[Supabase](https://supabase.com):** PostgreSQL database, Realtime subscriptions, auth
- **[HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/):** MQTT broker for hardware communication
- **[Vercel](https://vercel.com):** Web app deployment (`project-frequency`)
