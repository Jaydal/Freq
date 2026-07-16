# Display Service + Court LED Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `DisplayService` as the single source of truth for court display content, backed by Supabase persistence, exposed live via SSE to a new public `/display/:courtId` LED mirror page (and a `/display` index), while retiring the dead HTTP display transport.

**Architecture:** All display-setting call sites route through `lib/display-service.ts`, which persists to two new Supabase tables (`display_states` snapshot + `display_history` log), publishes to MQTT for the firmware (best-effort, unchanged transport), and notifies in-memory SSE subscribers. A streaming route handler (`/api/display/[courtId]/stream`) turns those notifications into Server-Sent Events consumed by the new mirror pages.

**Tech Stack:** Next.js App Router (Route Handlers, Server/Client Components), Supabase (Postgres + JS client), Server-Sent Events (native `ReadableStream`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-05-display-service-mirror-design.md`

All file paths below are relative to `web/` unless prefixed `firmware/`. Run all commands from the `web/` directory unless noted.

---

### Task 1: Retire the dead HTTP display transport

The HTTP pull/push path (`/api/display`, `/api/display/[row]`, `lib/esp32.ts`) POSTs to an ESP32-hosted HTTP server (`DynamicDisplayController`) that is never instantiated by any firmware build — both production variants use MQTT exclusively. This is confirmed dead code. `getControllerUrl()` (in `lib/esp32.ts`) is also the only remaining caller of the Prisma health check in `api/health/route.ts`, so that check is simplified too.

**Files:**
- Delete: `src/app/api/display/route.ts`
- Delete: `src/app/api/display/route.test.ts`
- Delete: `src/app/api/display/[row]/route.ts`
- Delete: `src/app/api/display/[row]/route.test.ts`
- Delete: `src/lib/esp32.ts`
- Delete: `src/lib/esp32.test.ts`
- Delete: `firmware/src/DynamicDisplayController.h`
- Delete: `firmware/src/DynamicDisplayController.cpp`
- Modify: `src/app/api/queue/[id]/route.test.ts` (strip the now-dangling `lib/esp32` mock/import)
- Modify: `src/app/api/health/route.ts` (drop the Prisma check)

- [ ] **Step 1: Delete the dead files**

```bash
rm src/app/api/display/route.ts src/app/api/display/route.test.ts
rm -rf "src/app/api/display/[row]"
rm src/lib/esp32.ts src/lib/esp32.test.ts
rm ../firmware/src/DynamicDisplayController.h ../firmware/src/DynamicDisplayController.cpp
```

- [ ] **Step 2: Strip the dangling `lib/esp32` mock from `queue/[id]/route.test.ts`**

This test already mocks `@/lib/prisma` (the route actually uses `@/lib/supabase/server` — a pre-existing, unrelated breakage from an earlier migration, out of scope for this plan). It also mocks `@/lib/esp32`'s `pushDisplay`, which the route doesn't even call (it calls `publishDisplay` from `@/lib/mqtt`). Since `lib/esp32.ts` no longer exists, remove every reference to it so the file doesn't fail to resolve the module:

Remove these lines:
```ts
vi.mock('@/lib/esp32', () => ({
  pushDisplay: vi.fn().mockResolvedValue(true),
}))
```
and:
```ts
import { pushDisplay } from '@/lib/esp32'
```
and the two assertions:
```ts
    expect(pushDisplay).toHaveBeenCalledWith(['COURT 1', '2v2', 'RUNNING'])
```
```ts
    await PATCH(new Request('http://localhost'), params('g1'))
    expect(pushDisplay).toHaveBeenCalledWith(['COURT 3', '2v2', 'RUNNING'])
```
(Leave the surrounding `it(...)` blocks and every other assertion in the file exactly as they are — this test file has pre-existing failures unrelated to this plan; we're only removing references to a module that no longer exists, not fixing its other issues.)

- [ ] **Step 3: Simplify the health check**

Read the current file first:

Run: `cat src/app/api/health/route.ts`

Replace its full contents with:

```ts
import { NextResponse } from 'next/server';
import { ensureConnected, isBrokerConnected, getCourtStatuses } from '@/lib/mqtt';
import { createClient } from '@/lib/supabase/server';

const started = Date.now();

export async function GET() {
  // Ensure MQTT client is initialized
  ensureConnected();

  const [broker, supabaseDb, courtStatuses] = await Promise.all([
    Promise.resolve(isBrokerConnected()),
    createClient()
      .then(sb => sb.from('courts').select('id').limit(1))
      .then(({ error }) => error ? `error: ${error.message}` : 'ok')
      .catch((e: Error) => `error: ${e.message}`),
    Promise.resolve(getCourtStatuses()),
  ]);

  const brokerOk = broker;
  const dbOk = supabaseDb === 'ok';
  const ok = brokerOk && dbOk;

  const status: Record<string, unknown> = {
    ok,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - started) / 1000),
    memory: process.memoryUsage(),
    node: process.version,
    env: process.env.NODE_ENV ?? 'development',
    connections: {
      broker: broker ? 'connected' : 'disconnected',
      supabase: supabaseDb,
    },
    courtDevices: Object.fromEntries(
      Object.entries(courtStatuses).map(([id, s]) => [id, {
        status: s.status,
        ip: s.ip,
        rssi: s.rssi,
        court: s.court,
        seenAt: s.seenAt,
        ago: `${Math.floor((Date.now() - s.seenAt) / 1000)}s`,
      }]),
    ),
  };

  return NextResponse.json(status, { status: ok ? 200 : 503 });
}
```

- [ ] **Step 4: Verify the app still typechecks and the remaining tests aren't newly broken**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "add-member-dialog\|assign-rfid-dialog\|reload-wallet-dialog"
npx vitest run 2>&1 | tail -20
```

Expected: no typecheck errors printed (the three filtered-out lines are pre-existing, unrelated `asChild` prop errors). Vitest summary should show the same 12 pre-existing failures as before (all in `esp32.test.ts` — now gone — `queue/route.test.ts`, and `queue/[id]/route.test.ts`), just 3 fewer failing tests than before since `esp32.test.ts` no longer exists. No *new* failures should appear.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: retire dead HTTP display transport (esp32.ts, /api/display, DynamicDisplayController)"
```

---

### Task 2: Add Supabase schema for display state + history

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Append the new tables**

Add this block to `supabase/schema.sql`, after the `courts` table definition and before the `register_game` function:

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

- [ ] **Step 2: Run it against the live Supabase project**

This file is applied manually (per the comment at the top of `supabase/schema.sql`: "Run this once in Supabase Dashboard → SQL Editor"). Paste the two `CREATE TABLE` statements above (they're idempotent — safe to run alongside the rest of the file) into the Supabase SQL Editor for project `iqkebvbcspnohjxanehl` and execute. This can happen whenever the user applies the rest of the pending schema fix from the earlier dev-environment diagnosis — it does not block writing the rest of this plan's code.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add display_states and display_history tables"
```

---

### Task 3: Add /display routes to the public allowlist

**Files:**
- Modify: `src/lib/supabase/middleware.ts:42-48`

- [ ] **Step 1: Update the public-route check**

Current code (lines 42-48):

```ts
  const isPublicRoute = request.nextUrl.pathname.startsWith('/login') ||
                        request.nextUrl.pathname.startsWith('/api/controller') ||
                        request.nextUrl.pathname.startsWith('/api/public') ||
                        request.nextUrl.pathname.startsWith('/api/health') ||
                        request.nextUrl.pathname.startsWith('/health') ||
                        request.nextUrl.pathname.startsWith('/terminal') ||
                        request.nextUrl.pathname === '/';
```

Replace with:

```ts
  const isDisplayStreamRoute = /^\/api\/display\/[^/]+\/stream$/.test(request.nextUrl.pathname);

  const isPublicRoute = request.nextUrl.pathname.startsWith('/login') ||
                        request.nextUrl.pathname.startsWith('/api/controller') ||
                        request.nextUrl.pathname.startsWith('/api/public') ||
                        request.nextUrl.pathname.startsWith('/api/health') ||
                        request.nextUrl.pathname.startsWith('/health') ||
                        request.nextUrl.pathname.startsWith('/terminal') ||
                        request.nextUrl.pathname.startsWith('/display') ||
                        isDisplayStreamRoute ||
                        request.nextUrl.pathname === '/';
```

Note the regex is deliberately scoped to only `/api/display/<courtId>/stream` — `/api/display/publish` (the authenticated manual-display route used by the dashboard) must **not** become public, so we don't blanket-match `/api/display` with `startsWith`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat: make /display and its SSE stream public routes"
```

---

### Task 4: Build the Display Service core (setDisplay / getDisplay / getAllDisplays)

**Files:**
- Create: `src/lib/display-service.ts`
- Create: `src/lib/display-service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/display-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

type MockResult = { data: any; error: any }

function chainable(result: MockResult, listResult?: MockResult) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    upsert: vi.fn(async () => result),
    insert: vi.fn(async () => result),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (r: MockResult) => void) => resolve(listResult ?? result),
  }
  return builder
}

function makeSupabase(byTable: Record<string, ReturnType<typeof chainable>>) {
  return { from: vi.fn((table: string) => byTable[table]) }
}

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/mqtt', () => ({ publishDisplay: vi.fn().mockResolvedValue(true) }))

import { createClient } from '@/lib/supabase/server'
import { publishDisplay } from '@/lib/mqtt'
import { setDisplay, getDisplay, getAllDisplays, subscribe } from './display-service'

describe('setDisplay', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts display_states, inserts display_history, publishes MQTT, and notifies subscribers', async () => {
    const courts = chainable({ data: { id: 'court-1', name: 'Court 1' }, error: null })
    const states = chainable({ data: null, error: null })
    const history = chainable({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(makeSupabase({
      courts, display_states: states, display_history: history,
    }) as any)

    const received: any[] = []
    subscribe('court-1', (s) => received.push(s))

    const result = await setDisplay('court-1', { line1: 'A', line2: 'B', line3: 'C' })

    expect(states.upsert).toHaveBeenCalledWith(expect.objectContaining({
      court_id: 'court-1', line1: 'A', line2: 'B', line3: 'C',
    }))
    expect(history.insert).toHaveBeenCalledWith(expect.objectContaining({
      court_id: 'court-1', line1: 'A', line2: 'B', line3: 'C',
    }))
    expect(publishDisplay).toHaveBeenCalledWith('court-1', { line1: 'A', line2: 'B', line3: 'C' })
    expect(result.courtName).toBe('Court 1')
    expect(received).toHaveLength(1)
    expect(received[0].line1).toBe('A')
  })

  it('throws when the court does not exist', async () => {
    const courts = chainable({ data: null, error: { message: 'not found' } })
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ courts }) as any)

    await expect(setDisplay('missing', { line1: '', line2: '', line3: '' }))
      .rejects.toThrow('Court not found')
  })

  it('does not throw when MQTT publish fails', async () => {
    const courts = chainable({ data: { id: 'court-1', name: 'Court 1' }, error: null })
    const states = chainable({ data: null, error: null })
    const history = chainable({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(makeSupabase({
      courts, display_states: states, display_history: history,
    }) as any)
    vi.mocked(publishDisplay).mockRejectedValue(new Error('broker down'))

    await expect(setDisplay('court-1', { line1: 'A', line2: 'B', line3: 'C' })).resolves.toBeDefined()
  })
})

describe('getDisplay', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns blank-line state for a valid court with no display_states row yet', async () => {
    const courts = chainable({ data: { id: 'court-1', name: 'Court 1' }, error: null })
    const states = chainable({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ courts, display_states: states }) as any)

    const state = await getDisplay('court-1')
    expect(state).toEqual({
      courtId: 'court-1', courtName: 'Court 1',
      line1: '', line2: '', line3: '', updatedAt: null,
    })
  })

  it('returns null for a nonexistent court', async () => {
    const courts = chainable({ data: null, error: { message: 'not found' } })
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ courts }) as any)

    const state = await getDisplay('missing')
    expect(state).toBeNull()
  })
})

describe('getAllDisplays', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists every court, filling in blank lines for courts with no display yet', async () => {
    const courts = chainable(
      { data: null, error: null },
      { data: [{ id: 'court-1', name: 'Court 1' }, { id: 'court-2', name: 'Court 2' }], error: null }
    )
    const states = chainable(
      { data: null, error: null },
      { data: [{ court_id: 'court-1', line1: 'X', line2: 'Y', line3: 'Z', updated_at: '2026-01-01T00:00:00Z' }], error: null }
    )
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ courts, display_states: states }) as any)

    const result = await getAllDisplays()
    expect(result).toEqual([
      { courtId: 'court-1', courtName: 'Court 1', line1: 'X', line2: 'Y', line3: 'Z', updatedAt: '2026-01-01T00:00:00Z' },
      { courtId: 'court-2', courtName: 'Court 2', line1: '', line2: '', line3: '', updatedAt: null },
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/lib/display-service.test.ts
```

Expected: FAIL — `Cannot find module './display-service'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/display-service.ts
import { createClient } from '@/lib/supabase/server';
import { publishDisplay, type DisplayPayload } from '@/lib/mqtt';

export interface DisplayState {
  courtId: string;
  courtName: string;
  line1: string;
  line2: string;
  line3: string;
  updatedAt: string | null; // ISO timestamp; null if this court has no display_states row yet
}

type Subscriber = (state: DisplayState) => void;

const g = global as typeof globalThis & {
  _displaySubscribers?: Map<string, Set<Subscriber>>;
};
if (!g._displaySubscribers) g._displaySubscribers = new Map();

function subscribers(): Map<string, Set<Subscriber>> {
  return g._displaySubscribers!;
}

export function subscribe(courtId: string, cb: Subscriber): () => void {
  if (!subscribers().has(courtId)) subscribers().set(courtId, new Set());
  subscribers().get(courtId)!.add(cb);
  return () => {
    subscribers().get(courtId)?.delete(cb);
  };
}

function notify(state: DisplayState): void {
  const subs = subscribers().get(state.courtId);
  if (!subs) return;
  for (const cb of subs) cb(state);
}

export async function setDisplay(courtId: string, lines: DisplayPayload): Promise<DisplayState> {
  const supabase = await createClient();

  const { data: court, error: courtErr } = await supabase
    .from('courts')
    .select('id, name')
    .eq('id', courtId)
    .single();
  if (courtErr || !court) throw new Error('Court not found');

  const { error: upsertErr } = await supabase
    .from('display_states')
    .upsert({
      court_id: courtId,
      line1: lines.line1,
      line2: lines.line2,
      line3: lines.line3,
      updated_at: new Date().toISOString(),
    });
  if (upsertErr) throw new Error(`Failed to save display state: ${upsertErr.message}`);

  await supabase
    .from('display_history')
    .insert({ court_id: courtId, line1: lines.line1, line2: lines.line2, line3: lines.line3 });

  publishDisplay(courtId, lines).catch((err) => {
    console.error('[display-service] MQTT publish failed:', err);
  });

  const state: DisplayState = {
    courtId,
    courtName: (court as { id: string; name: string }).name,
    line1: lines.line1,
    line2: lines.line2,
    line3: lines.line3,
    updatedAt: new Date().toISOString(),
  };

  notify(state);
  return state;
}

export async function getDisplay(courtId: string): Promise<DisplayState | null> {
  const supabase = await createClient();

  const { data: court, error: courtErr } = await supabase
    .from('courts')
    .select('id, name')
    .eq('id', courtId)
    .single();
  if (courtErr || !court) return null;

  const { data: row } = await supabase
    .from('display_states')
    .select('line1, line2, line3, updated_at')
    .eq('court_id', courtId)
    .maybeSingle();

  return {
    courtId,
    courtName: (court as { id: string; name: string }).name,
    line1: row?.line1 ?? '',
    line2: row?.line2 ?? '',
    line3: row?.line3 ?? '',
    updatedAt: row?.updated_at ?? null,
  };
}

export async function getAllDisplays(): Promise<DisplayState[]> {
  const supabase = await createClient();

  const { data: courts } = await supabase.from('courts').select('id, name').order('name');
  if (!courts) return [];

  const { data: rows } = await supabase
    .from('display_states')
    .select('court_id, line1, line2, line3, updated_at');
  const byCourtId = new Map((rows ?? []).map((r: any) => [r.court_id, r]));

  return (courts as Array<{ id: string; name: string }>).map((c) => {
    const row = byCourtId.get(c.id);
    return {
      courtId: c.id,
      courtName: c.name,
      line1: row?.line1 ?? '',
      line2: row?.line2 ?? '',
      line3: row?.line3 ?? '',
      updatedAt: row?.updated_at ?? null,
    };
  });
}
```

This imports `DisplayPayload` from `lib/mqtt.ts`, which is already exported there (`export interface DisplayPayload { line1: string; line2: string; line3: string; }`) — no change needed to that file.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/lib/display-service.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/display-service.ts src/lib/display-service.test.ts
git commit -m "feat: add DisplayService with Supabase persistence and pub/sub"
```

---

### Task 5: Build the SSE stream route

**Files:**
- Create: `src/app/api/display/[courtId]/stream/route.ts`
- Create: `src/app/api/display/[courtId]/stream/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/display/[courtId]/stream/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/display-service', () => ({
  getDisplay: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}))

import { getDisplay } from '@/lib/display-service'
import { GET } from './route'

describe('GET /api/display/[courtId]/stream', () => {
  it('sends the current snapshot as the first SSE event', async () => {
    const state = { courtId: 'court-1', courtName: 'Court 1', line1: 'A', line2: 'B', line3: 'C', updatedAt: null }
    vi.mocked(getDisplay).mockResolvedValue(state as any)

    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ courtId: 'court-1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')

    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    expect(text).toBe(`data: ${JSON.stringify(state)}\n\n`)
    await reader.cancel()
  })

  it('returns 404 for an unknown court', async () => {
    vi.mocked(getDisplay).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ courtId: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run "src/app/api/display/[courtId]/stream/route.test.ts"
```

Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/display/[courtId]/stream/route.ts
import { getDisplay, subscribe, type DisplayState } from '@/lib/display-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courtId: string }> }
) {
  const { courtId } = await params;

  const initial = await getDisplay(courtId);
  if (!initial) {
    return new Response('Court not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (state: DisplayState) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
      };

      send(initial);
      unsubscribe = subscribe(courtId, send);

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 20000);
    },
    cancel() {
      unsubscribe();
      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run "src/app/api/display/[courtId]/stream/route.test.ts"
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/display/[courtId]/stream/route.ts" "src/app/api/display/[courtId]/stream/route.test.ts"
git commit -m "feat: add SSE stream route for live display updates"
```

---

### Task 6: Wire existing call sites to DisplayService

Six places currently call `publishDisplay()` directly. All six switch to `setDisplay()` from `lib/display-service.ts` so `DisplayService` really is the only path that sets a court's display, per the design goal.

**Files:**
- Modify: `src/app/api/queue/[id]/route.ts`
- Modify: `src/app/api/public/queue/route.ts`
- Modify: `src/app/api/public/game/start/route.ts`
- Modify: `src/app/api/public/game/end/route.ts`
- Modify: `src/app/api/controller/register-game/route.ts`
- Modify: `src/app/api/display/publish/route.ts`

- [ ] **Step 1: `queue/[id]/route.ts`**

Change the import:
```ts
import { publishDisplay } from '@/lib/mqtt';
```
to:
```ts
import { setDisplay } from '@/lib/display-service';
```

Change the call (inside `PATCH`):
```ts
  await publishDisplay(game.court_id, {
    line1: (game.courts as any)?.name?.toUpperCase() ?? 'COURT',
    line2: players || game.match_type,
    line3: 'RUNNING',
  });
```
to:
```ts
  await setDisplay(game.court_id, {
    line1: (game.courts as any)?.name?.toUpperCase() ?? 'COURT',
    line2: players || game.match_type,
    line3: 'RUNNING',
  });
```

- [ ] **Step 2: `public/queue/route.ts`**

Change the import:
```ts
import { publishDisplay } from '@/lib/mqtt';
```
to:
```ts
import { setDisplay } from '@/lib/display-service';
```

Change the call:
```ts
  publishDisplay(courtId, {
    line1: entry.courtName.toUpperCase(),
    line2: playerNames || matchType,
    line3: promoted ? 'PREPARING' : 'UP NEXT',
  }).catch(() => {});
```
to:
```ts
  setDisplay(courtId, {
    line1: entry.courtName.toUpperCase(),
    line2: playerNames || matchType,
    line3: promoted ? 'PREPARING' : 'UP NEXT',
  }).catch(() => {});
```

- [ ] **Step 3: `public/game/start/route.ts`**

Change the import:
```ts
import { publishDisplay } from '@/lib/mqtt';
```
to:
```ts
import { setDisplay } from '@/lib/display-service';
```

Change the call:
```ts
  publishDisplay(ongoing.courtId, {
    line1: ongoing.courtName.toUpperCase(),
    line2: playerNames || ongoing.matchType,
    line3: `${ongoing.duration} MIN`,
  }).catch(() => {});
```
to:
```ts
  setDisplay(ongoing.courtId, {
    line1: ongoing.courtName.toUpperCase(),
    line2: playerNames || ongoing.matchType,
    line3: `${ongoing.duration} MIN`,
  }).catch(() => {});
```

- [ ] **Step 4: `public/game/end/route.ts`**

Change the import:
```ts
import { publishDisplay } from '@/lib/mqtt';
```
to:
```ts
import { setDisplay } from '@/lib/display-service';
```

Change the call:
```ts
  publishDisplay(game.courtId, {
    line1: game.courtName.toUpperCase(),
    line2: 'COURT',
    line3: 'AVAILABLE',
  }).catch(() => {});
```
to:
```ts
  setDisplay(game.courtId, {
    line1: game.courtName.toUpperCase(),
    line2: 'COURT',
    line3: 'AVAILABLE',
  }).catch(() => {});
```

- [ ] **Step 5: `controller/register-game/route.ts`**

Change the import:
```ts
import { publishDisplay } from '@/lib/mqtt';
```
to:
```ts
import { setDisplay } from '@/lib/display-service';
```

Change the call:
```ts
  if (court) {
    publishDisplay(court.id, {
      line1: court.name.toUpperCase(),
      line2: matchType,
      line3: 'RUNNING',
    }).catch(() => {});
  }
```
to:
```ts
  if (court) {
    setDisplay(court.id, {
      line1: court.name.toUpperCase(),
      line2: matchType,
      line3: 'RUNNING',
    }).catch(() => {});
  }
```

- [ ] **Step 6: `display/publish/route.ts`**

This route reports success/failure back to the caller (`DisplayControl.tsx`'s "Sent ✓ / Failed ✗" button state), so unlike the fire-and-forget sites above, it needs a try/catch around the now-throwing `setDisplay()`. Replace the full file:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setDisplay } from '@/lib/display-service';

const schema = z.object({
  courtId: z.string().min(1),
  line1:   z.string().max(20).default(''),
  line2:   z.string().max(20).default(''),
  line3:   z.string().max(20).default(''),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { courtId, line1, line2, line3 } = result.data;
  try {
    await setDisplay(courtId, { line1, line2, line3 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
```

Note the semantic change: `ok` now reflects whether `DisplayService` (Supabase) accepted the write, not specifically whether the MQTT publish succeeded (that's best-effort inside `setDisplay()` now, matching every other call site).

- [ ] **Step 7: Typecheck and run the full test suite**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "add-member-dialog\|assign-rfid-dialog\|reload-wallet-dialog"
npx vitest run
```

Expected: no new typecheck errors; vitest shows the same pre-existing failure count as after Task 1 (no new failures — `queue/route.test.ts` and `queue/[id]/route.test.ts` were already failing due to the unrelated Prisma/Supabase mock mismatch, not because of `publishDisplay`/`setDisplay`).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/queue/[id]/route.ts src/app/api/public/queue/route.ts \
        src/app/api/public/game/start/route.ts src/app/api/public/game/end/route.ts \
        src/app/api/controller/register-game/route.ts src/app/api/display/publish/route.ts
git commit -m "refactor: route all display writes through DisplayService"
```

---

### Task 7: Build the LED dot-matrix font and rendering component

**Files:**
- Create: `src/app/display/[courtId]/led-font.ts`
- Create: `src/app/display/[courtId]/led-display.tsx`

- [ ] **Step 1: Write the font table**

Mirrors `firmware/src/FontTiny.h` exactly (3-column-wide glyphs, 5 rows tall, bit0=top row … bit4=bottom row) so the web mirror renders the same shapes the physical panel can.

```ts
// src/app/display/[courtId]/led-font.ts

const GLYPHS: Record<string, number[]> = {
  ' ': [0],
  '-': [4, 4, 4],
  '.': [16],
  '/': [24, 4, 3],
  '0': [31, 17, 31],
  '1': [0, 31, 0],
  '2': [29, 21, 23],
  '3': [21, 21, 31],
  '4': [7, 4, 31],
  '5': [23, 21, 29],
  '6': [31, 21, 29],
  '7': [1, 1, 31],
  '8': [31, 21, 31],
  '9': [23, 21, 31],
  ':': [10],
  'A': [31, 5, 31],
  'B': [31, 21, 10],
  'C': [31, 17, 17],
  'D': [31, 17, 14],
  'E': [31, 21, 17],
  'F': [31, 5, 1],
  'G': [31, 17, 29],
  'H': [31, 4, 31],
  'I': [17, 31, 17],
  'J': [24, 16, 31],
  'K': [31, 10, 17],
  'L': [31, 16, 16],
  'M': [31, 2, 31],
  'N': [31, 2, 29],
  'O': [31, 17, 31],
  'P': [31, 5, 7],
  'Q': [15, 9, 31],
  'R': [31, 13, 23],
  'S': [23, 21, 29],
  'T': [1, 31, 1],
  'U': [31, 16, 31],
  'V': [15, 24, 15],
  'W': [31, 8, 31],
  'X': [27, 4, 27],
  'Y': [3, 28, 3],
  'Z': [25, 21, 19],
};

const GLYPH_HEIGHT = 5;
const BLANK_GLYPH = [0, 0, 0];

export function glyphFor(char: string): number[] {
  return GLYPHS[char] ?? BLANK_GLYPH;
}

// Converts a line of text into a 2D grid of booleans: dots[row][col].
// Unsupported characters (anything not in GLYPHS) render as a blank 3-wide gap.
export function textToDotGrid(text: string): boolean[][] {
  const columns: number[] = [];
  for (const char of text.toUpperCase()) {
    if (columns.length > 0) columns.push(0); // 1-column gap between glyphs
    columns.push(...glyphFor(char));
  }
  if (columns.length === 0) columns.push(0);

  const dots: boolean[][] = Array.from({ length: GLYPH_HEIGHT }, () => []);
  for (const col of columns) {
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      dots[row].push(((col >> row) & 1) === 1);
    }
  }
  return dots;
}
```

- [ ] **Step 2: Write the rendering component**

```tsx
// src/app/display/[courtId]/led-display.tsx
'use client';

import { textToDotGrid } from './led-font';

const DOT_SIZE = 6; // px
const DOT_GAP = 2; // px
const LED_COLOR = '#ff3b30';

function DotRow({ text }: { text: string }) {
  const grid = textToDotGrid(text);
  return (
    <div className="flex flex-col" style={{ gap: DOT_GAP }}>
      {grid.map((row, rowIdx) => (
        <div key={rowIdx} className="flex" style={{ gap: DOT_GAP }}>
          {row.map((on, colIdx) => (
            <div
              key={colIdx}
              style={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: '50%',
                backgroundColor: on ? LED_COLOR : 'rgba(255,255,255,0.06)',
                boxShadow: on ? `0 0 4px ${LED_COLOR}` : 'none',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function LedDisplay({ lines }: { lines: [string, string, string] }) {
  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center gap-8 overflow-x-auto p-8">
      {lines.map((line, i) => (
        <DotRow key={i} text={line} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/display/[courtId]/led-font.ts src/app/display/[courtId]/led-display.tsx
git commit -m "feat: add LED dot-matrix font and rendering component"
```

---

### Task 8: Build the /display/:courtId mirror page

**Files:**
- Create: `src/app/display/[courtId]/page.tsx`
- Create: `src/app/display/[courtId]/display-mirror-client.tsx`

- [ ] **Step 1: Write the client component (opens the SSE connection)**

```tsx
// src/app/display/[courtId]/display-mirror-client.tsx
'use client';

import { useEffect, useState } from 'react';
import LedDisplay from './led-display';
import type { DisplayState } from '@/lib/display-service';

export default function DisplayMirrorClient({
  courtId,
  initial,
}: {
  courtId: string;
  initial: DisplayState;
}) {
  const [state, setState] = useState<DisplayState>(initial);

  useEffect(() => {
    const source = new EventSource(`/api/display/${courtId}/stream`);
    source.onmessage = (event) => {
      setState(JSON.parse(event.data));
    };
    return () => source.close();
  }, [courtId]);

  return <LedDisplay lines={[state.line1, state.line2, state.line3]} />;
}
```

- [ ] **Step 2: Write the server component (validates the court exists, provides the initial snapshot)**

```tsx
// src/app/display/[courtId]/page.tsx
import { notFound } from 'next/navigation';
import { getDisplay } from '@/lib/display-service';
import DisplayMirrorClient from './display-mirror-client';

export default async function DisplayMirrorPage({
  params,
}: {
  params: Promise<{ courtId: string }>;
}) {
  const { courtId } = await params;
  const initial = await getDisplay(courtId);
  if (!initial) notFound();

  return <DisplayMirrorClient courtId={courtId} initial={initial} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/display/[courtId]/page.tsx src/app/display/[courtId]/display-mirror-client.tsx
git commit -m "feat: add /display/:courtId LED mirror page"
```

---

### Task 9: Build the /display index page

**Files:**
- Create: `src/app/display/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/display/page.tsx
import Link from 'next/link';
import { getAllDisplays } from '@/lib/display-service';

export default async function DisplayIndexPage() {
  const displays = await getAllDisplays();

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Court Displays</h1>
      {displays.length === 0 ? (
        <p className="text-gray-400">No courts yet.</p>
      ) : (
        <ul className="space-y-2">
          {displays.map((d) => (
            <li key={d.courtId}>
              <Link href={`/display/${d.courtId}`} className="text-lg underline hover:text-gray-300">
                {d.courtName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "feat: add /display court index page"
```

---

### Task 10: End-to-end manual verification

**Files:** None (verification only)

- [ ] **Step 1: Full test suite + typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "add-member-dialog\|assign-rfid-dialog\|reload-wallet-dialog"
npx vitest run
```

Expected: no new typecheck errors; only the pre-existing, unrelated `queue/route.test.ts` and `queue/[id]/route.test.ts` failures remain (9 failing tests total — down from 12, since `esp32.test.ts`'s 3 failing tests are gone).

- [ ] **Step 2: Start the dev server (if not already running)**

```bash
npm run dev
```

- [ ] **Step 3: Exercise the flow**

```bash
curl -sS http://localhost:3000/api/display | head -c 200  # should 404 (no such API route anymore — expected)
curl -sS http://localhost:3000/display | head -c 200      # should return the index page HTML
```

Open `http://localhost:3000/display` in a browser — should list courts without requiring login. Click into a court — should show the black-background LED dot-matrix mirror (blank rows if nothing has ever been published to that court, per Task 4's `getDisplay()` behavior).

In a second terminal, trigger a display change through an existing flow, e.g. register a walk-in via the terminal (`http://localhost:3000/terminal`) or POST directly:

```bash
curl -sS -X POST http://localhost:3000/api/public/queue \
  -H 'Content-Type: application/json' \
  -d '{"courtId":"<a real court id from /api/public/courts>","matchType":"1v1","duration":30,"memberIds":["PB-TEST-001"]}'
```

Expected: the open `/display/:courtId` browser tab updates within ~1 second with no manual refresh, showing `PREPARING` (or `UP NEXT` if that court was already occupied).

- [ ] **Step 4: Verify the health endpoint no longer references Prisma**

```bash
curl -sS http://localhost:3000/api/health | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
```

Expected: `connections` object has only `broker` and `supabase` keys (no `prisma` key).
