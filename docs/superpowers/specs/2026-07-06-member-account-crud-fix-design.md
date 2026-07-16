# Member Account CRUD Fix + Prisma Retirement — Design

## Context

This is the second sub-project decomposed from the original "kiosk terminal" mega-request, chosen ahead of queue/booking persistence because it's a currently-broken bug blocking basic staff workflows, not new functionality.

The dashboard's Members, RFID, and Wallet pages all read from Supabase (`members`, `rfid_cards`, `wallet_transactions` tables via `@/lib/supabase/server`). But the three mutating actions behind those pages' "Add Member," "Assign RFID," and "Reload Wallet" dialogs — `createMember`, `assignRFID`, `reloadWallet` in `src/features/{members,rfid,wallet}/actions/index.ts` — still write via Prisma, into a *different* set of tables (`Member`, `RFIDCard`, `Wallet`, `WalletTransaction` — Prisma's PascalCase schema, defined in `prisma/schema.prisma` and `prisma/migrations/`). Postgres treats these as entirely separate tables from the lowercase ones the UI reads.

Two independent problems compound this:
1. Prisma's `DATABASE_URL` points at `db.<ref>.supabase.co:5432`, which only resolves to an IPv6 address — unreachable from this network. Every one of these three actions currently throws/fails outright.
2. Even with connectivity fixed, a successful write would land in the shadow PascalCase tables, which nothing else in the app ever queries. A member "created" this way would never appear in the Members list.

Grep confirms these are the only three real (non-test, non-health-check) Prisma call sites left in the app; `src/app/api/health/route.ts`'s Prisma check is already being removed by the separately-planned Display Service work. Staff login already runs entirely through Supabase Auth (`create-admin.js`, `src/lib/supabase/*`) — Prisma's `User`/`Role` models have no callers anywhere and are already fully dead.

## Goals

- `createMember`, `assignRFID`, `reloadWallet` write to the same Supabase tables the dashboard pages read, so the dashboard's core member/RFID/wallet management actually works.
- `createMember` (member + wallet) and `reloadWallet` (balance update + transaction log) remain atomic — both writes succeed or neither does.
- Fully retire Prisma from the repo: schema, migrations, seed script, `lib/prisma.ts`, and the now-unused package dependencies (`@prisma/client`, `prisma`, `bcrypt`, `@types/bcrypt`, `ts-node` — verified via grep to have no other callers).
- Add test coverage for all three actions (none exist today, unlike the API routes which all have `.test.ts` siblings).

## Non-goals

- No UI/dialog changes — `AddMemberDialog`, `AssignRFIDDialog`, `ReloadWalletDialog` keep their exact current fields, validation, and error-toast behavior.
- No change to how `memberId` is entered (still manually typed by staff, matching today's behavior) — auto-generation is a separate, unrequested feature.
- No replacement seed script. `prisma/seed.ts`'s bootstrapping of roles/admin user is already superseded by `create-admin.js` (Supabase Auth); its court seeding is already covered by `add-courts.js` and `supabase/schema.sql`'s own seed block. Its remaining unique value (a handful of named test members) becomes redundant once `createMember` actually works — staff can just create them through the dashboard.

## Database changes (`supabase/schema.sql`)

Two new RPC functions, following the exact style of the existing `register_game()` function:

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

`assignRFID` doesn't get an RPC — it's a single insert guarded by two pre-checks, and `rfid_cards.uid`'s existing UNIQUE constraint is the real correctness backstop against a race between the pre-check and the insert.

## Actions (TypeScript)

All three keep their exact current function signatures (so the dialogs need zero changes) and exact current error messages (so existing `toast()` calls keep working):

```ts
// src/features/members/actions/index.ts
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

```ts
// src/features/rfid/actions/index.ts
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

```ts
// src/features/wallet/actions/index.ts
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

## Error handling

| Case | Behavior |
|---|---|
| Duplicate `memberId` or `email` in `createMember` | RPC raises `'Member ID or email already exists'`; action throws that message; dialog's existing generic catch shows "Failed to create member" (unchanged UX — the dialog doesn't currently surface the specific error text) |
| Unknown `memberId` in `assignRFID` | Throws `'Member not found'` (unchanged message) |
| UID already assigned in `assignRFID` | Throws `'RFID already assigned'` (unchanged message) |
| Race between assignRFID's pre-check and insert | DB unique constraint on `rfid_cards.uid` rejects the second concurrent insert; surfaced as the Postgres error message via `error.message` |
| Unknown `memberId` in `reloadWallet` | RPC raises `'Member not found'` |
| Missing wallet in `reloadWallet` (shouldn't happen since `createMember` always creates one) | RPC raises `'Wallet not found'` |

## Prisma retirement

- Delete: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `src/lib/prisma.ts`.
- `package.json`: remove `@prisma/client`, `prisma`, `bcrypt`, `@types/bcrypt`, `ts-node` from dependencies/devDependencies; remove the `"postinstall": "prisma generate"` script.
- No other files import any of these (verified via grep — `lib/prisma.ts` was the only `PrismaClient` importer; `bcrypt` had zero callers outside the deleted `prisma/seed.ts`; `ts-node` had zero script/config references).

## Testing

New test files, mocking the Supabase client the same way as `src/lib/display-service.test.ts`:

- `src/features/members/actions/index.test.ts` — `createMember` calls `rpc('create_member', ...)` with the right params; throws the RPC's error message on failure.
- `src/features/rfid/actions/index.test.ts` — `assignRFID` throws `'Member not found'` / `'RFID already assigned'` appropriately; inserts with the right params on success.
- `src/features/wallet/actions/index.test.ts` — `reloadWallet` calls `rpc('reload_wallet', ...)` with the right params; throws the RPC's error message on failure.

## Follow-up sub-projects (not in this spec)

- Queue/booking persistence: migrating `game-store.ts`'s in-memory walk-in queue to Supabase (next up).
- The remaining kiosk terminal work (RFID hardware pipeline, terminal state machine, voucher system) from the original decomposition.
