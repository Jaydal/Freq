# Pickleball Court Prompter — Agent Guide

## Project

Pickleball court management system with RFID kiosk, queue management, LED display control via MQTT, and admin dashboard.

## Tech Stack

- **Next.js** (App Router) — fullstack framework
- **Supabase** — PostgreSQL DB + auth
- **MQTT** — real-time LED display updates (ESP32)
- **shadcn/ui** + Tailwind — UI components
- **next-themes** — dark/light mode toggle
- **@scalar/nextjs-api-reference** — API docs

## Build & Verify

```bash
npm run build
npx vitest run
```

Expected: `59/62` pass (3 pre-existing `esp32.test.ts` failures unrelated to app logic).

## Key Architecture

### MQTT Topics

| Topic | Direction | Payload | Description |
|---|---|---|---|
| `courts/{courtId}/display` | Server → ESP32 | `{"line1","line2","line3"}` | LED display content (published with `retain: true`) |
| `courts/{courtId}/status` | ESP32 → Server | `{"status","ip","rssi","court"}` | ESP32 health heartbeat |
| `freq.led/courts/{courtId}/status` | ESP32 → Server | (same as above) | Legacy alternate topic |

Server subscribes to both `courts/+/display` and `courts/+/status` (plus `freq.led/courts/+/status`).

### Multi-Panel LED Display (3× P10, 96×16)

The system supports **3 P10 LED panels** chained horizontally (each 32×16, total 96×16 pixels). Content is divided into **zones** — each zone spans 1+ contiguous panels and is independently configured.

**Zone model** (defined in `src/components/display/zone-types.ts`):
- A **DisplayPage** contains `zones[]` and `durationSeconds`
- Each **DisplayZone** has `panelStart`, `panelEnd` (0-2), and `lines[]`
- Each **DisplayLine** has `text`, `color` (hex), `effect` (SCROLL/STATIC/BLINK/paginate)
- Zones partition the 3 panels contiguously. Max 3 zones. Max 2 lines per zone.
- 1-line zones render text at 2× scale (10×14px), vertically centered
- 2-line zones render text at 1× scale (5×7px), stacked with 2px gap

**Layout templates** (zone presets):
- `All 3 Combined` — 1 zone across all panels, 2 lines
- `2+1 Split` — panels 0-1 (64px, 2 lines) + panel 2 (32px, 1 line)
- `1+1+1` — each panel independent, 1 line
- `1+2 Split` — panel 0 (32px, 1 line) + panels 1-2 (64px, 2 lines)

**Visual Designer** (`DisplaySequenceEditorV2` in settings):
- WYSIWYG editor replacing the old JSON textarea
- `P10Canvas`: interactive 3-panel SVG preview (96×16) with clickable zone regions
- `ZonePanel`: sidebar for editing selected zone (panel assignment, line count, per-line text/color/effect with variable autocomplete)
- `PageToolbar`: page dots navigation + add/remove + duration per page
- `TemplateDropdown`: one-click zone layout presets
- Live preview renders LED dots using the same 5×7 bitmap font as the firmware

**Sequence storage** — stored in `settings` table key `displaySequence`:
- Three sections: `idle`, `prep`, `game`
- Each section has `interval` (default page duration) and `pages[]` with zone definitions
- Backward compatible: old flat-format pages (text/color/effect without zones) auto-convert to a single zone spanning all 3 panels

**Supported variables** (substituted server-side in `sports-caster.ts` and client-side for timer):
`{court_name}`, `{match_title}`, `{match_type}`, `{duration}`, `{players}`, `{timer}`, `{elapsed}`, `{queue_count}`, `{next_name}`, `{next_match}`

Cycles through pages via `POST /api/display/publish-all` (called every 5s by client processor).

### Offer Flow

1. Queue entry created (status `waiting`)
2. Court becomes available → entry status changes to `offered` with 30s timeout (`QUEUE_DEFAULT_TIMEOUT_MS = 30000`)
3. Terminal shows 30s countdown
4. User clicks Accept → `PATCH /api/queue` with `action: accept`
5. If timer expires → `processExpiredOffers()` auto-accepts via API call

### Pricing

Rates stored in `settings` table under key `prices` (JSON: `{"30":150,"60":300,"90":450}`).
Server fetches rates from settings — no hardcoded values.
`getCost(config, duration, partySize)` — UI price calculation.
Server-side `calcCharge()` in `queue-service.ts` uses same formula.

### Wallet Deduction

Atomic optimistic locking: `.eq('balance', oldBalance)` prevents race conditions.
`register_game` RPC handles atomic deductions on offer acceptance.
Refunds distribute equally across all `game_players`.

### Realtime Subscriptions

Supabase Realtime channels on `games`, `courts`, `queue_entries` tables:
- `kiosk-processor` — TerminalKiosk (10s poll fallback)
- `queue-board` — QueueBoard (5s poll fallback)
- `court-overview` — CourtOverview sidebar (5s poll fallback)

## Key Files

| File | Purpose |
|---|---|
| `src/lib/mqtt.ts` | MQTT client, publish/subscribe, display state cache |
| `src/lib/complete-expired-games.ts` | Client-side: expire offers, expire games, process available courts, publish court displays |
| `src/lib/queue/queue-service.ts` | Join/leave queue, wallet deduction |
| `src/lib/queue/queue-processor.ts` | Server-side: process court, expire offers/games |
| `src/lib/queue/booking-engine.ts` | Slot availability checks |
| `src/lib/queue/reservation-service.ts` | Accept/decline offers |
| `src/components/terminal/TerminalKiosk.tsx` | Full kiosk booking flow |
| `src/components/terminal/QueueBoard.tsx` | Public court + queue display |
| `src/components/display/P10Display.tsx` | Dot-matrix P10 LED simulator (legacy single-page) |
| `src/components/display/P10Canvas.tsx` | Interactive 3-panel zone preview (96×16 SVG) |
| `src/components/display/ZonePanel.tsx` | Zone property editor sidebar |
| `src/components/display/PageToolbar.tsx` | Page navigation + duration control |
| `src/components/display/TemplateDropdown.tsx` | Zone layout preset dropdown |
| `src/components/display/DisplaySequenceEditorV2.tsx` | Visual WYSIWYG display sequence designer |
| `src/components/display/zone-types.ts` | Zone model TypeScript types |
| `src/features/settings/components/DisplaySequenceEditor.tsx` | Admin: display template editor (re-exports V2) |
| `src/features/settings/components/ProductsEditor.tsx` | Admin: products/pricing editor |
| `src/app/api/display/publish-all/route.ts` | Periodic display publisher |
| `src/app/api/display/state/[courtId]/route.ts` | Get current display state |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/queue?memberId=` | Get member's queue entries |
| POST | `/api/queue` | Join queue or auto-assign |
| PATCH | `/api/queue` | Accept/decline offer |
| GET | `/api/mqtt` | MQTT broker status + court displays |
| POST | `/api/mqtt/publish` | Publish test display message |
| GET | `/api/display/state/{courtId}` | Get current display for a court |
| POST | `/api/display/publish-all` | Refresh all court displays |
| POST | `/api/display/heartbeat` | Track active display viewers |
| PUT | `/api/settings` | Update a setting key/value |
| GET | `/api/docs` | Scalar API reference |

## Database (Supabase)

Key tables: `courts`, `games`, `game_players`, `queue_entries`, `members`, `wallets`, `wallet_transactions`, `rfid_cards`, `settings`, `ControllerLog`.

RLS is disabled on all tables.

## Important Constants

- `QUEUE_DEFAULT_TIMEOUT_MS = 30000` — offer confirmation timeout (30s, part of 5min prep)
- `SUCCESS_DELAY_MS = 5000` — success screen auto-return
- 5 minute prep time: 30s confirmation + 2:15 entry + 2:15 exit

## ESP32 Firmware

Located in `/FreqClient/` (library) and `firmware/` (ESP32 code). Topics:
- Subscribe: `courts/{courtId}/display`
- Publish status: `courts/{courtId}/status`
- Display payload: `{line1, line2, line3}` (max 16 chars each)
