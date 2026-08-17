# Root page hang: investigation and fix

## Problem
- `npm run dev` shows `adapterFn is not a function`
- After config fix, root page `/` hangs indefinitely on load

## Root cause
1. Stray `/Users/junedelmar/package-lock.json` makes Turbopack resolve modules from home `node_modules`, breaking the middleware bundle.
2. After that is fixed, the landing page Server Component calls `createClient()` → `cookies()` from `next/headers`, which can hang in Turbopack. `getPrices()` only times out the Supabase query, not `createClient()` itself, so the page stalls forever.

## Fixes already applied
- `web/next.config.ts`: `turbopack.root` set to absolute `web/` path via `__dirname`
- `web/src/components/terminal/QueueBoard.tsx`: error state + retry instead of infinite `Loading...`
- `web/src/app/(auth)/update-password/page.tsx`: `.catch()` on `exchangeCodeForSession`

## Remaining implementation
1. Add a timeout to `createClient()` in `src/lib/supabase/server.ts` so `cookies()` / Supabase client creation cannot block a Server Component forever.
2. Add a timeout to `getPrices()` in `src/app/page.tsx` around the whole `createClient()` + query path, not just the query.
3. Restart `npm run dev` and verify `http://localhost:3001` loads within 5s.

## Validation
- `npm run build` succeeds
- `npx vitest run` passes (expected 59/62)
- Landing page renders in browser without hanging
