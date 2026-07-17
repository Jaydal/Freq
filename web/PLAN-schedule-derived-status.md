# Plan: Derive all booking status from the schedule (time-based) — drop status-flip dependency

## Goal
Per user direction: **all booking status is derived from the schedule (`start_time` + `prep` + `duration`) vs. current time.** We no longer need a background process to flip `games.status` → `Completed` / `courts.status` → `Available` for the *view* to be correct. The board must still show **active** (a court whose schedule window includes "now") and **waiting** (people in the queue). Pure derivation, drop the status-flip.

Single source of truth = `games` rows (`court_id`, `start_time`, `duration`). `courts.status` / `games.status` columns become historical only and are **not** used to decide liveness.

## Key findings (verified)
- Kiosk C client (`board_parser.c`, `court_status_card.c`, `live_data_provider.c`) **already trusts the server's `active` boolean + `startTime`** and computes elapsed/phase from its own (server-synced) clock. So the fix is **server-side only** — emit the correct `active` and the rest follows.
- `board-snapshot.ts:95-118` currently sets `active:true` for ANY game row with a `start_time`, ignoring whether the schedule ended. **This is the bug**: a finished game keeps showing active until its row is marked Completed (which never happens on Vercel serverless).
- `queue-service.ts:111` direct-book only books a court if `courts.status === 'Available'` — also status-based; should be schedule-based (`isSlotAvailable`).
- `queue-processor.ts`: `processWaitingEntries` busy-detection uses `status IN ['In Progress','Scheduled']`; `processExpiredGames` flips statuses (the part we're dropping for display, but waiter auto-promotion still needs to run).
- `booking-engine.ts` `isSlotAvailable` is **already schedule-based** — keep as-is.
- `QueueBoard.tsx`, `CourtStatusCard.tsx`, `CourtOverview.tsx`, `TerminalKiosk.fetchCourts` derive "active/busy" from `status` columns — switch to schedule derivation.

## Changes

### 1. `web/src/lib/queue/board-snapshot.ts` (core)
- Add a helper `isActiveNow(game, prepTimeSec)` = `!!game.start_time && Date.now() < new Date(game.start_time).getTime() + effectivePrepSec(game.duration, prepTimeSec)*1000 + game.duration*60000`.
- In the courts map (lines 95-118): pick the game for the court (as today), but set `active: isActiveNow(game, prepTimeSec)`. Keep `startTime`/`durationMin`/`players` regardless (so the C client's elapsed math handles past games gracefully — but `active:false` hides the timer via `court_status_card.c:23,50`).
- The `games` query can drop the `in('status',[...])` filter (we want all games, and filter by time). Keep selecting `start_time`, `duration`, `match_type`, `match_title`, `game_players`.
- `waiting`/`nowServing` (queue_entries) already emitted separately — unchanged (this is the "waiting" the user wants to keep).

### 2. `web/src/lib/queue/queue-processor.ts`
- **`processWaitingEntries`**: replace busy-court detection. A court is "busy now" if it has a game whose schedule window includes `now` (`isActiveNow`-style check on `games.start_time+duration+prep`). Query all games, filter in code (or `lt('start_time', now)` + check end). This makes auto-promotion schedule-driven and independent of `games.status`.
- **`processExpiredGames`**: remove the `set('Completed')` / `set('Available')` mutations (display no longer needs them). Keep calling `processCourt` per court that has just ended its schedule, and `processWaitingEntries()` at the end, so **existing waiters still auto-promote** onto the now-free court (that part is a real DB mutation via `register_game` and still required).
  - Net effect: courts auto-show-free via derivation; waiters get promoted when `processWaitingEntries` runs (triggered on each queue mutation + `/api/queue/tick`).

### 3. `web/src/lib/queue/queue-service.ts` (`joinQueue`)
- Line 111: replace `selected.status === 'Available'` with a schedule check: book directly only if the court has **no active game now** (`isSlotAvailable(selected.id, now, now+duration)`). This fixes "free court not booked while a waiter exists for another court" permanently via real availability, not a stale `courts.status`.

### 4. Web components → schedule-based `isActive`
- `CourtStatusCard.tsx:42` `isActive = court.status === 'In Progress'` → `isActive = !!court.start_time && now < end` (compute from `start_time`+`duration`+`prepTimeSec`; reuse existing `effectivePrepSec`/`phaseForElapsed` already imported).
- `CourtOverview.tsx:79-92` `status: game.status === 'In Progress' ? ... : 'Available'` → `status: isActiveNow ? 'In Progress' : 'Available'` using same schedule check.
- `TerminalKiosk.fetchCourts:242-247` `busyIds` from `games` `status` → compute from games whose schedule includes now (mirror `isActiveNow`).

### 5. Keep historical views intact
- `reports/page.tsx`, `dashboard/page.tsx`, `courts/page.tsx`: these show *history* (Completed vs In Progress). Leave them reading `status` for historical records — but where they show a live "busy" badge, switch to schedule derivation for consistency (low risk; optional). Primary focus is the live board + kiosk.

### 6. Tests
- Update/extend `board-snapshot` tests: a game whose `end < now` must yield `active:false` (even if `status='In Progress'`).
- Add `queue-service` test: booking a court with a just-ended game still books directly (schedule-free, regardless of `courts.status`).
- Keep existing regression tests (`queue-advance`, `queue-preference`, `joinqueue`, `advance-serverless`) passing.
- The `advance-serverless.regression.test.ts` already exists; ensure `processWaitingEntries` is the trigger used by the route (it is, via `route.ts:64`).

## Out of scope
- LED `sports-caster.ts` already consumes `current`/`upcoming` from the board snapshot payload; no status-column dependency expected. Quick check only.
- Not removing the `status` columns from the DB or RLS; they remain as historical records.

## Verification
- `npx vitest run src/lib/queue/` → all pass (expect 25+ before + new).
- `npm run build` (Next.js) compiles + TypeScript clean.
- Manual: book a court, confirm board shows active; after duration+prep elapses with no backend timer, confirm the court automatically shows Available and a waiting entry (if any) is promoted when a mutation/tick fires.
- Deploy to Vercel (`vercel deploy --prod`).
