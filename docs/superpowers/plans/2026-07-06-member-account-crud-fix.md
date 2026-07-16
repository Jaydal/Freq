# Member Account CRUD Fix + Prisma Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `createMember`, `assignRFID`, and `reloadWallet` so they write to the same Supabase tables the dashboard reads from (they currently write via Prisma into a disconnected shadow schema), and fully retire Prisma from the repo.

**Architecture:** Two new Postgres RPC functions (`create_member`, `reload_wallet`) handle the two multi-step atomic writes, matching the existing `register_game()` pattern. `assignRFID` becomes plain sequential Supabase calls backed by the DB's existing UNIQUE constraint. All three `'use server'` action files switch from `@/lib/prisma` to `@/lib/supabase/server`.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres + JS client), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-06-member-account-crud-fix-design.md`

All file paths below are relative to `web/` unless noted. Run all commands from the `web/` directory.

---

### Task 1: Add the create_member and reload_wallet RPC functions

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Append the two functions**

Add this block to `supabase/schema.sql`, after the existing `register_game()` function:

```sql
-- Atomic member creation: member row + zero-balance wallet, or neither.
CREATE OR REPLACE FUNCTION create_member(
  p_member_id  TEXT,
  p_first_name TEXT,
  p_last_name  TEXT,
  p_email      TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  INSERT INTO members (member_id, first_name, last_name, email)
  VALUES (p_member_id, p_first_name, p_last_name, NULLIF(p_email, ''))
  RETURNING id INTO v_member_id;

  INSERT INTO wallets (member_id, balance) VALUES (v_member_id, 0);

  RETURN v_member_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Member ID or email already exists';
END;
$$;

-- Atomic wallet reload: balance increment + transaction log, or neither.
CREATE OR REPLACE FUNCTION reload_wallet(
  p_member_id        TEXT,
  p_amount           NUMERIC,
  p_reference_number TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_member  members%ROWTYPE;
  v_wallet  wallets%ROWTYPE;
  v_tx_id   UUID;
BEGIN
  SELECT * INTO v_member FROM members WHERE member_id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  SELECT * INTO v_wallet FROM wallets WHERE member_id = v_member.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;

  UPDATE wallets SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO wallet_transactions (wallet_id, amount, type, reference_number, remarks)
  VALUES (v_wallet.id, p_amount, 'Reload', NULLIF(p_reference_number, ''), 'Manual Top Up')
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;
```

- [ ] **Step 2: Run it against the live Supabase project**

Paste the two `CREATE OR REPLACE FUNCTION` statements above into the Supabase SQL Editor for project `iqkebvbcspnohjxanehl` and execute. `CREATE OR REPLACE` is safe to re-run. This can happen whenever the user next applies pending schema changes — it doesn't block writing the rest of this plan's code.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add create_member and reload_wallet RPC functions"
```

---

### Task 2: Fix createMember

**Files:**
- Modify: `src/features/members/actions/index.ts`
- Create: `src/features/members/actions/index.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/members/actions/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createMember } from './index'

function makeSupabase(rpcResult: { data: any; error: any }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) }
}

describe('createMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls create_member RPC with mapped params', async () => {
    const supabase = makeSupabase({ data: 'new-member-id', error: null })
    vi.mocked(createClient).mockResolvedValue(supabase as any)

    await createMember({ memberId: 'PB-001', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' })

    expect(supabase.rpc).toHaveBeenCalledWith('create_member', {
      p_member_id: 'PB-001',
      p_first_name: 'Jane',
      p_last_name: 'Doe',
      p_email: 'jane@example.com',
    })
  })

  it('throws the RPC error message on failure', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'Member ID or email already exists' } })
    vi.mocked(createClient).mockResolvedValue(supabase as any)

    await expect(createMember({ memberId: 'PB-001', firstName: 'Jane', lastName: 'Doe', email: '' }))
      .rejects.toThrow('Member ID or email already exists')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/features/members/actions/index.test.ts
```

Expected: FAIL — `createMember` currently calls `prisma.member.create`, not `supabase.rpc`, so the mock assertions don't match (and `createClient` from `@/lib/supabase/server` is never called at all).

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/features/members/actions/index.ts`:

```ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createMember(data: {
  firstName: string;
  lastName: string;
  email: string;
  memberId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_member', {
    p_member_id: data.memberId,
    p_first_name: data.firstName,
    p_last_name: data.lastName,
    p_email: data.email,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/members');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/features/members/actions/index.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/members/actions/index.ts src/features/members/actions/index.test.ts
git commit -m "fix: createMember writes to Supabase instead of disconnected Prisma tables"
```

---

### Task 3: Fix assignRFID

**Files:**
- Modify: `src/features/rfid/actions/index.ts`
- Create: `src/features/rfid/actions/index.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/rfid/actions/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { assignRFID } from './index'

type Result = { data: any; error: any }

function chainable(result: Result) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => result),
    insert: vi.fn(async () => result),
  }
  return builder
}

function makeSupabase(byTable: Record<string, ReturnType<typeof chainable>>) {
  return { from: vi.fn((table: string) => byTable[table]) }
}

describe('assignRFID', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a new rfid_cards row when the member exists and the UID is free', async () => {
    const members = chainable({ data: { id: 'member-1' }, error: null })
    const rfidCards = chainable({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ members, rfid_cards: rfidCards }) as any)

    await assignRFID({ memberId: 'PB-001', uid: 'UID-123' })

    expect(rfidCards.insert).toHaveBeenCalledWith({ uid: 'UID-123', member_id: 'member-1', status: 'Active' })
  })

  it('throws Member not found when the member lookup misses', async () => {
    const members = chainable({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ members }) as any)

    await expect(assignRFID({ memberId: 'missing', uid: 'UID-123' }))
      .rejects.toThrow('Member not found')
  })

  it('throws RFID already assigned when the UID is taken', async () => {
    const members = chainable({ data: { id: 'member-1' }, error: null })
    const rfidCards = chainable({ data: { id: 'existing-card' }, error: null })
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ members, rfid_cards: rfidCards }) as any)

    await expect(assignRFID({ memberId: 'PB-001', uid: 'UID-123' }))
      .rejects.toThrow('RFID already assigned')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/features/rfid/actions/index.test.ts
```

Expected: FAIL — current implementation calls `prisma.member.findUnique`/`prisma.rFIDCard.*`, not `supabase.from(...)`.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/features/rfid/actions/index.ts`:

```ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function assignRFID(data: { memberId: string; uid: string }) {
  const supabase = await createClient();

  const { data: member } = await supabase
    .from('members').select('id').eq('member_id', data.memberId).single();
  if (!member) throw new Error('Member not found');

  const { data: existing } = await supabase
    .from('rfid_cards').select('id').eq('uid', data.uid).single();
  if (existing) throw new Error('RFID already assigned');

  const { error } = await supabase
    .from('rfid_cards')
    .insert({ uid: data.uid, member_id: member.id, status: 'Active' });
  if (error) throw new Error(error.message);

  revalidatePath('/rfid');
  revalidatePath('/members');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/features/rfid/actions/index.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/rfid/actions/index.ts src/features/rfid/actions/index.test.ts
git commit -m "fix: assignRFID writes to Supabase instead of disconnected Prisma tables"
```

---

### Task 4: Fix reloadWallet

**Files:**
- Modify: `src/features/wallet/actions/index.ts`
- Create: `src/features/wallet/actions/index.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/wallet/actions/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { reloadWallet } from './index'

function makeSupabase(rpcResult: { data: any; error: any }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) }
}

describe('reloadWallet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls reload_wallet RPC with mapped params', async () => {
    const supabase = makeSupabase({ data: 'tx-id', error: null })
    vi.mocked(createClient).mockResolvedValue(supabase as any)

    await reloadWallet({ memberId: 'PB-001', amount: 500, referenceNumber: 'REF-1' })

    expect(supabase.rpc).toHaveBeenCalledWith('reload_wallet', {
      p_member_id: 'PB-001',
      p_amount: 500,
      p_reference_number: 'REF-1',
    })
  })

  it('throws the RPC error message on failure', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'Member not found' } })
    vi.mocked(createClient).mockResolvedValue(supabase as any)

    await expect(reloadWallet({ memberId: 'missing', amount: 500, referenceNumber: '' }))
      .rejects.toThrow('Member not found')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/features/wallet/actions/index.test.ts
```

Expected: FAIL — current implementation uses `prisma.$transaction`, not `supabase.rpc`.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/features/wallet/actions/index.ts`:

```ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function reloadWallet(data: {
  memberId: string;
  amount: number;
  referenceNumber: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('reload_wallet', {
    p_member_id: data.memberId,
    p_amount: data.amount,
    p_reference_number: data.referenceNumber,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/wallet');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/features/wallet/actions/index.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/wallet/actions/index.ts src/features/wallet/actions/index.test.ts
git commit -m "fix: reloadWallet writes to Supabase instead of disconnected Prisma tables"
```

---

### Task 5: Retire Prisma

At this point nothing in `src/` calls Prisma except two already-broken, pre-existing test files (`src/app/api/queue/route.test.ts` and `src/app/api/queue/[id]/route.test.ts`) that mock `@/lib/prisma` even though the routes they test have long since switched to Supabase — every test in both files is already failing (confirmed earlier this session: they're part of the 12 pre-existing failures, unrelated to this plan). Deleting `lib/prisma.ts` changes *why* those two files fail (module resolution instead of a stale mock) but does not turn any currently-passing test red — this is called out explicitly so it isn't mistaken for a regression.

**Files:**
- Delete: `prisma/schema.prisma`
- Delete: `prisma/migrations/` (directory)
- Delete: `prisma/seed.ts`
- Delete: `src/lib/prisma.ts`
- Modify: `package.json`

- [ ] **Step 1: Delete the Prisma files**

The working tree has other unrelated uncommitted changes already in it (from earlier session work) — use `git rm` here instead of plain `rm` so the deletions are staged precisely, keeping this task's eventual commit scoped to exactly what it touches:

```bash
git rm -r prisma
git rm src/lib/prisma.ts
```

- [ ] **Step 2: Remove the now-unused dependencies and postinstall script**

Read the current file first:

Run: `cat package.json`

Remove the line `"postinstall": "prisma generate",` from `scripts`.

Remove `"@prisma/client": "^5.22.0",` from `dependencies`.

Remove these four lines from `devDependencies`: `"@types/bcrypt": "^6.0.0",`, `"bcrypt": "^6.0.0",`, `"prisma": "^5.22.0",`, `"ts-node": "^10.9.2",`.

- [ ] **Step 3: Reinstall to update the lockfile**

```bash
npm install
```

Expected: completes without error; `package-lock.json` no longer references `prisma`, `@prisma/client`, `bcrypt`, `@types/bcrypt`, or `ts-node`.

- [ ] **Step 4: Typecheck and run the full test suite**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "add-member-dialog\|assign-rfid-dialog\|reload-wallet-dialog"
npx vitest run 2>&1 | tail -25
```

Expected: no new typecheck errors (the three filtered lines are pre-existing, unrelated `asChild` prop errors). Vitest should show the same *passing* test count as before this task, plus the 7 new tests from Tasks 2–4. `queue/route.test.ts` and `queue/[id]/route.test.ts` continue to fail (as they did before this plan), now due to `Cannot find module '@/lib/prisma'` instead of stale assertions.

- [ ] **Step 5: Commit**

The `git rm` calls in Step 1 already staged the deletions. Stage only the other files this task touched — do **not** use `git add -A`, since the working tree has unrelated uncommitted changes from earlier session work that don't belong in this commit:

```bash
git add package.json package-lock.json
git commit -m "chore: retire Prisma (schema, migrations, seed script, package deps)"
```

---

### Task 6: End-to-end manual verification

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server (if not already running)**

```bash
npm run dev
```

- [ ] **Step 2: Exercise Add Member through the dashboard**

Open `http://localhost:3000/members`, click "Add Member," fill in a unique Member ID/first/last name, submit. Expected: dialog closes, toast reads "Member created successfully!", and the new member appears in the table immediately (server action's `revalidatePath('/members')` refetches).

- [ ] **Step 3: Exercise Assign RFID**

Open `http://localhost:3000/rfid`, click "Assign RFID," enter the Member ID just created and a new UID, submit. Expected: success toast, new row appears in the RFID table, and the Members page now shows that UID instead of "Not Assigned."

- [ ] **Step 4: Exercise Reload Wallet**

Open `http://localhost:3000/wallet`, click "Reload Wallet," enter the same Member ID and an amount, submit. Expected: success toast, new "Reload" row appears in the transactions table, and the Members page shows the updated balance.

- [ ] **Step 5: Verify duplicate/error handling**

Repeat Step 2 with the exact same Member ID. Expected: toast reads "Failed to create member" (the RPC's `unique_violation` catch fires, no duplicate row is created). Repeat Step 3 with the same UID again. Expected: toast reads "Failed: RFID already assigned".
