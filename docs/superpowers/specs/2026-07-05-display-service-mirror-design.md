# Display Service + Court LED Mirror — Design

## Context

This is the first of several sub-projects decomposed from a larger "kiosk terminal" request (touch-only `/terminal` on real hardware, RFID hardware pipeline, voucher system, walk-in queue UX, and this display mirror). It was chosen to go first because it's fully self-contained — no dependency on RFID, vouchers, or the queue-offer/accept-decline decision still open for the terminal sub-project.

Today, display content reaches the physical LED panel through `publishDisplay()` (`web/src/lib/mqtt.ts`), called ad hoc from three places: `queue/[id]` PATCH, `public/queue` POST, and the dashboard's manual display panel. Nothing caches "what's currently on court X's display" anywhere — it's fire-and-forget MQTT. There is also a second, dead transport: `/api/display`, `/api/display/[row]`, and `lib/esp32.ts` POST directly to an ESP32-hosted HTTP server (`DynamicDisplayController`) that is never actually instantiated in `firmware/src/main.cpp` — both production firmware variants (`FreqClient` for MAX7219, `MqttDisplayClient` for HUB75) are MQTT-only.

## Goals

- A single `DisplayService` module becomes the *only* way anything sets a court's display — matching `Booking Updated → Display Service → {mirror, firmware}`, not `Booking Updated → MQTT → {mirror, firmware}`.
- A public, no-login `/display/:courtId` page mirrors exactly what's on the physical panel, updating live with no polling/refresh.
- A public `/display` index lists all courts.
- Display state (current + full history) persists in Supabase — not just held in memory — surviving restarts.
- Retire the dead HTTP transport (`/api/display`, `/api/display/[row]`, `lib/esp32.ts`, `firmware/src/DynamicDisplayController.{h,cpp}`) and drop Prisma from `/api/health` (its only remaining caller after this cleanup).

## Non-goals

- No booking, check-in, or admin functionality on the mirror pages.
- No changes to firmware — it already just renders whatever MQTT sends it.
- No richer structured display model (status enums, player objects, etc.) — the model is the raw 3-line text exactly as shown on the panel today. Extending it later is straightforward since `DisplayService` is the single choke point.
- No full removal of Prisma from the repo (schema/migrations/package dependency stay, just with zero remaining runtime callers after this spec).

## Architecture

```
queue/[id] PATCH  ─┐
public/queue POST ─┼──► DisplayService.setDisplay(courtId, {line1,line2,line3})
DisplayControl.tsx ┘              │
                                   ├──► Supabase: upsert display_states, insert display_history row
                                   ├──► publishDisplay() → MQTT → firmware (best-effort, unchanged)
                                   └──► notify in-memory SSE subscribers for that courtId
                                              │
                                              ▼
                        GET /api/display/[courtId]/stream  (Server-Sent Events)
                                              │
                                              ▼
                        /display/[courtId]  (LED mirror)   and   /display  (index)
```

## Data model

Two new Supabase tables, added to `web/supabase/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS display_states (
  court_id   UUID PRIMARY KEY REFERENCES courts(id) ON DELETE CASCADE,
  line1      TEXT NOT NULL DEFAULT '',
  line2      TEXT NOT NULL DEFAULT '',
  line3      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS display_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  court_id   UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  line1      TEXT NOT NULL DEFAULT '',
  line2      TEXT NOT NULL DEFAULT '',
  line3      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS display_history_court_id_created_at_idx
  ON display_history(court_id, created_at DESC);
```

`display_states` is the fast-read current snapshot (one row per court, upserted). `display_history` is an append-only audit log for debugging/monitoring — matches the "development, testing, debugging" purpose of the mirror page.

## Service contract (`web/src/lib/display-service.ts`)

```ts
export interface DisplayState {
  courtId: string;
  courtName: string;
  line1: string;
  line2: string;
  line3: string;
  updatedAt: string | null; // ISO timestamp; null if this court has no display_states row yet
}

export async function setDisplay(
  courtId: string,
  lines: { line1: string; line2: string; line3: string }
): Promise<DisplayState>;

export async function getDisplay(courtId: string): Promise<DisplayState | null>;
export async function getAllDisplays(): Promise<DisplayState[]>;
// getDisplay/getAllDisplays LEFT JOIN courts → display_states, so every
// *existing* court appears (courtName always populated) even before its
// first setDisplay() call — line1/2/3 default to '' and updatedAt is null.
// getDisplay() returns null only when courtId doesn't match any court at all.

// In-memory pub/sub feeding the SSE route. Same globalThis-cached pattern as
// lib/game-store.ts and lib/mqtt.ts, so it survives Next.js dev hot-reload.
export function subscribe(courtId: string, cb: (state: DisplayState) => void): () => void;
```

`setDisplay()` order of operations: upsert `display_states` → insert `display_history` row → call existing `publishDisplay()` (MQTT; failure is logged, not thrown — matches today's fire-and-forget semantics at call sites) → notify subscribers → return the new state. The three existing call sites (`queue/[id]` PATCH, `public/queue` POST, the manual display panel's publish route) switch from calling `publishDisplay()` directly to calling `DisplayService.setDisplay()`.

## Real-time transport

`GET /api/display/[courtId]/stream` — a streaming Next.js route handler (Server-Sent Events). No custom server or WebSocket infra needed (`ws` is an unused package dependency; there's no custom server file — just `next dev`/`next start`), and the data only flows one direction (server → browser), which SSE fits natively.

Behavior: on connect, send `getDisplay(courtId)` immediately as the first event; then push on every `setDisplay()` call for that court via `subscribe()`; send a `: ping\n\n` heartbeat comment every ~20s to survive idle proxies/timeouts; clean up the subscription on `request.signal.abort`. The browser's native `EventSource` handles reconnection automatically — no custom retry logic needed client-side.

## Pages

- **`/display/[courtId]`** (public, no auth) — black background, simulated LED dot-matrix rendering (not just styled text) using the same constrained glyph set as the firmware's `FontTiny.h` (uppercase A–Z, 0–9, space, `: - / .`), so the mirror is authentic to what the physical panel can actually render. Opens an `EventSource` to the stream route on mount, renders the 3 lines as they update. Unknown `courtId` → 404. Valid court with no `display_states` row yet → blank/placeholder rows (not an error).
- **`/display`** (public, no auth) — simple index of all courts (`getAllDisplays()` or the courts list) linking to each `/display/:courtId`.
- Both routes added to the public allowlist in `web/src/lib/supabase/middleware.ts` alongside `/terminal`.

## Cleanup

- Delete: `web/src/app/api/display/route.ts`, `web/src/app/api/display/[row]/route.ts` (+ their `.test.ts` files), `web/src/lib/esp32.ts` (+ `esp32.test.ts`), `firmware/src/DynamicDisplayController.{h,cpp}`.
- `web/src/app/api/health/route.ts`: drop the Prisma `$queryRaw` check entirely (its only other caller, `getControllerUrl()`, is being deleted) — health becomes `ok = brokerOk && supabaseOk`.
- `firmware/platformio.ini`: `DynamicDisplayController.cpp` isn't referenced by any build filter, so no `platformio.ini` change is needed — deleting the files is sufficient.

## Error handling

| Case | Behavior |
|---|---|
| Unknown `courtId` | 404 on the page; SSE route returns 404 before opening the stream |
| Valid court, no display yet | Blank/placeholder LED rows, not an error |
| MQTT publish fails inside `setDisplay()` | Logged, does not fail the request — DB write + SSE notify still happen |
| Supabase write fails inside `setDisplay()` | Request fails (this is the source of truth — a failed persist should surface as an error to the caller) |
| SSE connection drops | Browser's native `EventSource` reconnects automatically |

## Testing

- Unit tests for `display-service.ts` (mocked Supabase client): `setDisplay()` upserts + inserts history + calls `publishDisplay()` + notifies subscribers; `getDisplay()` returns a blank-line state (not null) for a valid court with no `display_states` row yet, and `null` for a nonexistent `courtId`.
- A basic shape check on the SSE route's initial event (that it emits the current snapshot before any update).
- UI pages (`/display/[courtId]`, `/display`) get manual verification rather than automated tests, consistent with how `/terminal` is handled today.

## Follow-up sub-projects (not in this spec)

- Migrating `game-store.ts`'s in-memory walk-in queue/ongoing-games to Supabase persistence (next up).
- RFID hardware pipeline (ESP32-S3 + reader → backend, replacing the keyboard-wedge text input).
- Kiosk terminal state machine, including resolving the queue-promotion UX conflict (instant auto-promote + prep delay vs. offer/countdown/accept/decline).
- Voucher system.
