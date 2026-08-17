# Bulk RFID Registration — Implementation Summary

## Feature
New bulk RFID card registration flow for admins at `/rfid/bulk`.

## Route
`/rfid/bulk`

Accessible from the sidebar under **Management → Bulk Register**.

## Behavior
- Each simulated scan registers a new `rfid_cards` row with `status = 'Unassigned'`.
- The review table shows registered cards with editable status and delete actions.
- Duplicate UIDs are rejected with a warning toast.
- Registration date is shown per card.

## Files Created
- `src/app/(dashboard)/rfid/bulk/page.tsx`
- `src/app/(dashboard)/rfid/bulk/bulk-register-client.tsx`
- `tests/e2e/rfid-bulk-registration.spec.ts`
- `playwright.config.ts`

## Files Modified
- `src/components/layout/sidebar.tsx`
- `vitest.config.ts`
- `package.json`

## Test Commands
```bash
# Unit tests
npm run test:run

# E2E tests
PLAYWRIGHT_TEST_EMAIL=admin@example.com PLAYWRIGHT_TEST_PASSWORD=password npm run test:e2e
```

## Notes
- RFID input is simulated via a text field for environments without NFC hardware.
- Pre-existing vitest timing issues remain unrelated to this change.
