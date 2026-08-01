# Fix Queue Criticals (recursion, double-booking, refunds, kiosk, broken tests)

**Date:** 2026-08-01
**Scope:** `web/` Next.js layer — the six release-blocking criticals from the code review of the uncommitted working tree.
**Constraint (AGENTS.md):** publish = display payloads + board snapshot; queue math lives only in `queue-processor.ts`. Fix (1) restores the intent: `processCourtQueue` **never** publishes; `publishAllDisplays()` is the single funnel (it already ends with `publishBoardOnce().catch(...)`, so the board publish survives).

**Baseline (run first):** `cd web && npx vitest run` — expect ~7 failures (route tests, sports-caster, P10Canvas).

## Task 1 — Decouple queue processing from publishing (Critical #1)

`web/src/lib/queue/queue-processor.ts`
- Delete `import { publishAllDisplays } ...` and `import { publishBoardOnce } from '@/lib/queue/board-publisher';`.
- `processCourtQueue` → `Promise<boolean>`; remove the publish calls at lines 64, 125-126, 133.
  - `if (!court) return false;` — occupied → `return false;` — `if (!waiting.length) { update Available; return false; }` — matched → `return true;` — loop exhausted → `return false;`.
- `processAllCourts`: add single-flight guard (prevents concurrent executions):

```ts
let processAllRunning = false;

export async function processAllCourts(): Promise<void> {
  if (processAllRunning) return;
  processAllRunning = true;
  try {
    const supabase = await createClient();
    const { data: courts } = await supabase.from('courts').select('id');
    if (!courts) return;
    for (const c of courts) await processCourtQueue(c.id);
  } finally {
    processAllRunning = false;
  }
}
```

`web/src/lib/queue/board-publisher.ts`
- Remove `import { processAllCourts, processCourtQueue } from './queue-processor';` and the call inside `publishBoardOnce` (lines 19-29). It becomes publish-only.

**Callers — remove now-duplicate/unsafe publishes:**
- `web/src/lib/queue/queue-service.ts`: completed path — replace fire-and-forget `fetch('/api/display/publish-all')` (line 155) with `publishAllDisplays().catch(console.error);`. Waiting path — delete `publishBoardOnce().catch(console.error);` (board publish now happens via `publishAllDisplays()`).
- `web/src/features/courts/actions/index.ts`:
  - `endGame`: `await processCourtQueue(courtId); await publishAllDisplays();` (drop trailing `publishBoardOnce()`).
  - `requeueGame`: keep order `mark completed → processCourtQueue → publishAllDisplays()` (drop early publishAllDisplays and trailing publishBoardOnce).
  - `updateGameDuration`: drop dead `court`/`queueCount`/`displaySequence` fetches and `publishBoardOnce()`; `await processCourtQueue(courtId); await publishAllDisplays();`.
  - `reorderQueue`/`reassignQueueEntry`: keep `publishBoardOnce()` (publish-only now — safe).
- `web/src/app/api/queue/route.ts`: POST — delete `await publishBoardOnce();` (publish happens in service). PATCH accept — delete it (`finalizeBooking` publishes). PATCH decline — **keep** (`declineOffer` doesn't publish).
- `web/src/app/api/queue/[id]/route.ts` DELETE: delete the dead `displaySequence` fetch; keep `publishAllDisplays()`.

**Tests:** `simulation.test.ts` (fake DB) — new waiting path only adds table queries; `queue-service.test.ts` mocks `processAllCourts` already. No test edits needed here.
**Commit:** `fix(queue): decouple processing from publishing to break recursion`

## Task 2 — Atomic claim + price guard (Critical #2, #8)

`web/src/lib/queue/queue-processor.ts` — the `for (const entry of waiting)` loop becomes:

```ts
for (const entry of waiting) {
  if (!entry.id) continue;
  const { data: claimed } = await supabase
    .from('queue_entries')
    .update({ status: 'claimed', updated_at: new Date().toISOString() })
    .eq('id', entry.id).eq('status', 'waiting')
    .select('id').maybeSingle();
  if (!claimed) continue;

  const { data: game } = await supabase.from('games').insert({
    court_id: court.id, court_name: court.name,
    match_type: entry.party_size === 4 ? '2v2' : '1v1',
    party_size: entry.party_size,
    duration: entry.duration, charge_amount: entry.charge,
    display_sequence: entry.display_sequence, status: 'Active',
    started_at: new Date().toISOString(),
  }).select('id').single();
  if (!game) {
    await supabase.from('queue_entries').update({ status: 'waiting' }).eq('id', entry.id);
    continue;
  }
  const gameId = game.id;

  // Task 4 — retarget the join deposit to this game
  if (entry.deposit_tx_id) {
    await supabase.from('wallet_transactions')
      .update({ reference_number: gameId, remarks: 'Deposit converted to game fee' })
      .eq('id', entry.deposit_tx_id);
  }

  const gpRows = entry.party_size === 2
    ? [{ member_id: entry.member_id, position: 1, team: 1 }]
    : [{ member_id: entry.member_id, position: 1, team: 1 },
       { member_id: entry.partner_id, position: 2, team: 1 }];
  const { error: gpErr } = await supabase.from('game_players').insert(gpRows);
  if (gpErr) {
    await supabase.from('queue_entries').update({ status: 'waiting' }).eq('id', entry.id);
    await supabase.from('games').delete().eq('id', gameId);
    continue;
  }

  await supabase.from('queue_entries').update({
    status: 'completed', game_id: gameId, position: 1,
    updated_at: new Date().toISOString(),
  }).eq('id', entry.id);
  await supabase.from('courts').update({ status: 'occupied', current_game_id: gameId }).eq('id', court.id);
  return true;
}
```
- Restore the free-game guard after `charge = calcCharge(...)`: `if (!charge || charge === 0) { console.error('No charge for game, skipping promotion'); return false; }` — fail-closed.
- Only the leader pays (single `deductWallet` per entry; partner refunds via `refundWallet`).

`web/src/lib/queue/board-snapshot.ts` (line 79): `.eq('status', 'waiting')` → `.in('status', ['waiting', 'claimed'])` so in-flight claims don't vanish from the kiosk.

**Tests:** add regression to `simulation.test.ts` — assert only one `games` insert despite two concurrent `processCourtQueue` calls (claim guard), and `db.update.calls` includes a `claimed` claim.
**Commit:** `fix(queue): atomic claim + fail-closed charge guard to prevent double booking`

## Task 3 — Surface publish failures (Critical #5)

`web/src/lib/display/publish-all.ts`

```ts
export interface PublishAllResult { ok: boolean; failed: number; total: number; }

export async function publishAllDisplays(): Promise<PublishAllResult> {
  let failed = 0; let total = 0;
  try {
    // existing snapshot/settings fetch unchanged (getHours() timezone note deferred)
    for (const c of snapshot.courts) {
      total++;
      const ok = await publishDisplay(c.id, payload);
      if (!ok) { failed++; console.error(`[publish-all] Failed to publish court ${c.id}`); }
    }
    publishBoardOnce().catch(() => {});
  } catch (err) {
    console.error('Failed to publish all displays:', err);
    failed++;
  }
  return { ok: failed === 0, failed, total };
}
```

`web/src/app/api/display/publish-all/route.ts` — both GET and POST:

```ts
const res = await publishAllDisplays();
if (!res.ok) return NextResponse.json({ error: `Publish failed (${res.failed}/${res.total})` }, { status: 500 });
return NextResponse.json({ success: true, ...res });
```

**Commit:** `fix(api): return 500 when display publish fails`

## Task 4 — Deposit/refund correctness (Critical #3, Importants #7/#8)

**SQL** (`web/supabase/schema.sql`, apply to hosted Supabase too):

```sql
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS deposit_tx_id UUID REFERENCES wallet_transactions(id);
```

And in `register_game` RPC: `INSERT INTO wallet_transactions (...) VALUES (v_wallet.id, v_charge, 'Game Charge', v_game_id, format('Match %s for %s mins on %s', p_match_type, p_duration, p_court_name));` — uses `v_game_id` so refunds can find per-player charges.

`web/src/lib/queue/queue-service.ts`
- `deductWallet` returns `string | null` (inserted `wallet_transactions.id` via `.select('id').single()`).
- New `refundTransaction(txId, remarks)`: load tx (id, wallet_id, amount); skip if absent/≤0; **idempotency guard** — skip if a `type='Refund'` row with `reference_number = 'refund-' + tx.id` exists; credit wallet via conditional `UPDATE wallets SET balance = balance + ? WHERE id = ? AND balance = ?` (throw on race); insert Refund row with that reference_number.
- `joinQueue` waiting path: `const depositTxId = await deductWallet(...)` → include `deposit_tx_id: depositTxId` in the queue_entries insert. Error path: replace double-deduct `refundWallet` with `await refundTransaction(depositTxId, 'Queue join failed')`; delete now-unused `refundWallet`.
- New `leaveQueue(entryId)` (for Task 5 cancel): load entry (id, deposit_tx_id, court_id) → refund deposit if present → mark `cancelled` → `if (court_id) await processCourtQueue(court_id)` → `await publishAllDisplays()`.

`web/src/features/courts/actions/index.ts` `endGame` refund rewrite:

```ts
if (refund && game && game.id) {
  const { data: txs } = await supabase
    .from('wallet_transactions')
    .select('id').eq('reference_number', game.id)
    .in('type', ['game_fee', 'Game Charge']);
  if (txs) for (const tx of txs) await refundTransaction(tx.id, 'Game refunded');
  else if (game.charge_amount && Number(game.charge_amount) > 0) {
    // fallback for legacy games: refund each payer's share
    const { data: payers } = await supabase
      .from('game_players').select('member_id').eq('game_id', game.id);
    for (const p of payers ?? []) await deductWallet(p.member_id, -Number(game.charge_amount), game.id);
  }
}
```
(import `refundTransaction`, `deductWallet` from queue-service; remove the old `game_players[0]` logic.)

**Tests:** `queue-service.test.ts` — leaveQueue test stays green (default mock `.single()` → undefined → early return). Add refundTransaction unit test: double-call → single Refund row; wrong-balance → throws.
**Commit:** `fix(wallet): refund per-payer via wallet transactions, deposit lifecycle on queue entries`

## Task 5 — Kiosk fixes (Critical #4, #9)

`web/src/components/terminal/TerminalKiosk.tsx`
- Add `const stepRef = useRef<KioskStep>('idle');` + `useEffect(() => { stepRef.current = step; }, [step]);`
- Line 164: `if (successTimer.current && stepRef.current !== 'success') clearTimeout(successTimer.current);`
- Completed branch: set status completed on queueEntry, carry `duration`/`party_size` into state before `setStep('success')`.
- `lookupMember` select: add `duration, party_size` (so offer + completed carry them).
- `handleJoinQueue`: else branch → `setQueueEntry(entry); setStep('existing-queue');`
- Replace both cancel handlers — no more `DELETEs` against `/api/queue/[id]` (404: queue_entries UUID vs games table) — use new server action `cancelQueueEntry`.

`web/src/app/terminal/queue/actions.ts` — add:

```ts
export async function cancelQueueEntry(entryId: string) {
  try { await leaveQueue(entryId); return { ok: true }; }
  catch (err) { console.error('cancelQueueEntry failed:', err); return { ok: false, error: err instanceof Error ? err.message : 'Cancel failed' }; }
}
```

**Commit:** `fix(kiosk): success timer only clears on step change; cancel via leaveQueue; waiting->existing-queue`

## Task 6 — Repair `[id]/route.test.ts` (Critical #6)
- Delete `vi.mock('@/lib/mqtt')` + `mockPublishDisplay` (route no longer imports mqtt).
- Add `const mockPublishAllDisplays = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));` + `vi.mock('@/lib/display/publish-all', () => ({ publishAllDisplays: (...a: any[]) => mockPublishAllDisplays(...a) }));`
- PATCH/DELETE tests: assert `mockPublishAllDisplays` was called.
**Commit:** `fix(test): update queue route tests for publish-all`

## Task 7 — Repair `sports-caster.test.ts` (Critical #6)
- test 1 (`CLOSED`): `pages` length 1; assert `pages[0].text.includes('CLOSED')` + blank not present.
- test 2 (`GAME`): `pages[1]` → `{timer}`; drop `pages[2]` assertion; length 2.
- test 4 (`NEXT`): `pages` length 1; assert contains `{next_match}`.
- test 3 + full-schedule test: unchanged.
**Commit:** `fix(test): update sports-caster expectations for new defaults`

## Task 8 — Preview parity with firmware (Critical #6 root)

`web/src/components/display/P10Canvas.tsx`
- Rewrite `textWidthPx` to mirror `Hub75Driver.cpp` glyph metrics (micro glyphs 7 wide, space/colon 3, bold adds 1 unless digit glyph, scale×, trailing spacing sub) — behavior identical to current defaults, so 7-wide tests still pass; space test changes 13 → 15.
- Zone scale resolution → firmware order (both-scales → X-only → Y-only → 2-lines→1 → SCROLL→2 → fit-check→1/2 → per-line overrides).

`web/src/components/display/P10Display.tsx`
- `FONT_DIGITAL[':']` → `0x18` (Hub75Driver.cpp:81).
- `getChar` digital glyph: `undefined` → fall back to `FONT[ch]` (Hub75Driver.cpp:763 — stops blank letters in preview).
- `textToDots`: space branch always advances `cw=3` (drop `font !== 'digital'` condition) — matches firmware space advance.
- `textWidth` (legacy): space/colon → 3; bold excludes space/colon; subtract trailing spacing.

**Commit:** `fix(display): mirror firmware glyph metrics and scale resolution in preview`

## Task 9 — API validation (Important #12, cheap)
`web/src/app/api/controller/register-game/route.ts` schema: `duration: z.number().positive()`, `chargeAmount: z.number().nonnegative()`, `players: z.array(...).min(1)`.
**Commit:** `fix(api): reject invalid register-game payloads`

## Verification (final)
1. `cd web && npx vitest run` — 0 failures.
2. `cd web && npx tsc --noEmit` — clean.
3. `cd display-firmware && pio run -e esp32-hub75-wf2` — untouched, but confirms no parser drift (payload shape unchanged).
4. Manual: PATCH `/api/queue` accept → success page auto-resets after 5s; cancel from kiosk → deposit refunded; `POST /api/display/publish-all` with MQTT down → 500.

**Deferred (second plan):** frozen BLINK on static pages + literal `{timer}` (firmware), MQTT buffer 8192, particle null-check, scroll clamp; SSE gating on MQTT health; QueueBoard initial-load retry; virtual-displays `blocks[].pages` + MockValuesPanel; timezone for `next_booked_time`; `.orig` cleanup; OpenAPI/AGENTS.md docs.
