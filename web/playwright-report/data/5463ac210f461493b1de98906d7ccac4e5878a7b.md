# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rfid-bulk-registration.spec.ts >> Bulk RFID Registration >> loads the bulk RFID registration page with correct title
- Location: tests/e2e/rfid-bulk-registration.spec.ts:31:3

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /Bulk RFID Registration/
Received string:  "Paddle Point — Pickleball Court Management"
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    14 × locator resolved to <html lang="en" class="dark">…</html>
       - unexpected value "Paddle Point — Pickleball Court Management"

```

```yaml
- text: Sign in Enter your email and password to access the portal Email
- textbox "Email":
  - /placeholder: m@example.com
- text: Password
- textbox "Password"
- link "Forgot password?":
  - /url: /forgot-password
- button "Sign In"
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | 
  3   | const LOGIN_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || '';
  4   | const LOGIN_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || '';
  5   | 
  6   | if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  7   |   console.warn('PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD are not set. Skipping E2E tests.');
  8   | }
  9   | 
  10  | async function loginIfNeeded(page: Page) {
  11  |   if (process.env.PLAYWRIGHT_TEST_BYPASS_AUTH === '1') {
  12  |     return; // Bypass auth
  13  |   }
  14  | 
  15  |   await page.goto('/login');
  16  |   await page.waitForLoadState('networkidle');
  17  | 
  18  |   await page.fill('input[type="email"]', LOGIN_EMAIL);
  19  |   await page.fill('input[type="password"]', LOGIN_PASSWORD);
  20  |   await page.click('button[type="submit"]');
  21  | 
  22  |   await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  23  | }
  24  | 
  25  | test.describe('Bulk RFID Registration', () => {
  26  |   test.beforeEach(async ({ page }) => {
  27  |     test.info().annotations.push({ type: 'issue', description: 'Simulated RFID input via text field' });
  28  |     await loginIfNeeded(page);
  29  |   });
  30  | 
  31  |   test('loads the bulk RFID registration page with correct title', async ({ page }) => {
  32  |     const uid = `TEST-${Date.now()}`;
  33  |     await page.goto('/rfid/bulk');
  34  |     await page.waitForLoadState('networkidle');
  35  | 
> 36  |     await expect(page).toHaveTitle(/Bulk RFID Registration/);
      |                        ^ Error: expect(page).toHaveTitle(expected) failed
  37  |   });
  38  | 
  39  |   test('displays the simulated RFID input', async ({ page }) => {
  40  |     await page.goto('/rfid/bulk');
  41  |     await page.waitForLoadState('networkidle');
  42  | 
  43  |     const input = page.locator('input[placeholder*="RFID" i], input[placeholder*="UID" i], input[aria-label*="RFID" i], input[aria-label*="UID" i]');
  44  |     await expect(input).toBeVisible();
  45  |   });
  46  | 
  47  |   test('registers a new card via simulated RFID input', async ({ page }) => {
  48  |     const uid = `TEST-${Date.now()}`;
  49  |     await page.goto('/rfid/bulk');
  50  |     await page.waitForLoadState('networkidle');
  51  | 
  52  |     const input = page.locator('input[placeholder*="RFID" i], input[placeholder*="UID" i], input[aria-label*="RFID" i], input[aria-label*="UID" i]').first();
  53  |     await input.fill(uid);
  54  |     await input.press('Enter');
  55  | 
  56  |     await page.waitForSelector(`text=${uid}`, { timeout: 10000 });
  57  | 
  58  |     const row = page.locator(`tr:has-text("${uid}")`);
  59  |     await expect(row).toBeVisible();
  60  | 
  61  |     const dateCell = row.locator('td').nth(2);
  62  |     const dateText = await dateCell.textContent();
  63  |     expect(dateText).toBeTruthy();
  64  |   });
  65  | 
  66  |   test('shows success toast after registering a new card', async ({ page }) => {
  67  |     const uid = `TEST-${Date.now()}`;
  68  |     await page.goto('/rfid/bulk');
  69  |     await page.waitForLoadState('networkidle');
  70  | 
  71  |     const input = page.locator('input[placeholder*="RFID" i], input[placeholder*="UID" i], input[aria-label*="RFID" i], input[aria-label*="UID" i]').first();
  72  |     await input.fill(uid);
  73  |     await input.press('Enter');
  74  | 
  75  |     const toast = page.locator('[role="status"], [role="alert"], .toast, [data-sonner-toast]').first();
  76  |     await expect(toast).toBeVisible({ timeout: 10000 });
  77  |     await expect(toast).toContainText(/success|registered|added/i);
  78  |   });
  79  | 
  80  |   test('prevents duplicate registration and shows warning', async ({ page }) => {
  81  |     const uid = `TEST-${Date.now()}`;
  82  |     await page.goto('/rfid/bulk');
  83  |     await page.waitForLoadState('networkidle');
  84  | 
  85  |     const input = page.locator('input[placeholder*="RFID" i], input[placeholder*="UID" i], input[aria-label*="RFID" i], input[aria-label*="UID" i]').first();
  86  | 
  87  |     await input.fill(uid);
  88  |     await input.press('Enter');
  89  |     await page.waitForSelector(`text=${uid}`, { timeout: 10000 });
  90  | 
  91  |     const initialCount = await page.locator('table tbody tr').count();
  92  | 
  93  |     await input.fill(uid);
  94  |     await input.press('Enter');
  95  | 
  96  |     const warningToast = page.locator('[role="status"], [role="alert"], .toast, [data-sonner-toast]').first();
  97  |     await expect(warningToast).toBeVisible({ timeout: 10000 });
  98  |     await expect(warningToast).toContainText(/duplicate|already|exists/i);
  99  | 
  100 |     const finalCount = await page.locator('table tbody tr').count();
  101 |     expect(finalCount).toBe(initialCount);
  102 |   });
  103 | 
  104 |   test('updates card status via dropdown', async ({ page }) => {
  105 |     const uid = `TEST-${Date.now()}`;
  106 |     await page.goto('/rfid/bulk');
  107 |     await page.waitForLoadState('networkidle');
  108 | 
  109 |     const input = page.locator('input[placeholder*="RFID" i], input[placeholder*="UID" i], input[aria-label*="RFID" i], input[aria-label*="UID" i]').first();
  110 |     await input.fill(uid);
  111 |     await input.press('Enter');
  112 |     await page.waitForSelector(`text=${uid}`, { timeout: 10000 });
  113 | 
  114 |     const row = page.locator(`tr:has-text("${uid}")`);
  115 |     const statusCell = row.locator('td').nth(3);
  116 |     const dropdown = statusCell.locator('select, [role="combobox"], button').first();
  117 |     await dropdown.click();
  118 | 
  119 |     const option = page.locator('[role="option"], option').first();
  120 |     await option.click();
  121 | 
  122 |     await page.waitForTimeout(1000);
  123 |   });
  124 | 
  125 |   test('deletes a registered card', async ({ page }) => {
  126 |     const uid = `TEST-${Date.now()}`;
  127 |     await page.goto('/rfid/bulk');
  128 |     await page.waitForLoadState('networkidle');
  129 | 
  130 |     const input = page.locator('input[placeholder*="RFID" i], input[placeholder*="UID" i], input[aria-label*="RFID" i], input[aria-label*="UID" i]').first();
  131 |     await input.fill(uid);
  132 |     await input.press('Enter');
  133 |     await page.waitForSelector(`text=${uid}`, { timeout: 10000 });
  134 | 
  135 |     const row = page.locator(`tr:has-text("${uid}")`);
  136 |     const deleteButton = row.locator('button[aria-label*="Delete" i], button:has-text("Delete")').first();
```