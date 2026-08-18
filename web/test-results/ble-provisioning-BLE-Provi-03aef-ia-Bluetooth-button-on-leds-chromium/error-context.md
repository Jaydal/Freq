# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ble-provisioning.spec.ts >> BLE Provisioning >> shows provision via Bluetooth button on /leds
- Location: tests/e2e/ble-provisioning.spec.ts:28:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Provision via Bluetooth/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /Provision via Bluetooth/i })

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
  1  | import { test, expect, type Page } from '@playwright/test';
  2  | 
  3  | function loginIfNeeded(page: Page) {
  4  |   if (process.env.PLAYWRIGHT_TEST_BYPASS_AUTH === '1') return Promise.resolve();
  5  |   return page.goto('/login').then(() => page.waitForLoadState('networkidle'));
  6  | }
  7  | 
  8  | async function ensureLoggedIn(page: Page) {
  9  |   await loginIfNeeded(page);
  10 | }
  11 | 
  12 | test.describe('BLE Provisioning', () => {
  13 |   test.beforeEach(async ({ page }) => {
  14 |     await ensureLoggedIn(page);
  15 |   });
  16 | 
  17 |   test('shows BLE unsupported message when navigator.bluetooth is missing', async ({ page }) => {
  18 |     await page.addInitScript(() => {
  19 |       delete (window as any).navigator.bluetooth;
  20 |     });
  21 | 
  22 |     await page.goto('/leds');
  23 |     await page.waitForLoadState('networkidle');
  24 | 
  25 |     await expect(page.getByText(/Bluetooth provisioning is not available/i)).toBeVisible();
  26 |   });
  27 | 
  28 |   test('shows provision via Bluetooth button on /leds', async ({ page }) => {
  29 |     await page.goto('/leds');
  30 |     await page.waitForLoadState('networkidle');
  31 | 
> 32 |     await expect(page.getByRole('button', { name: /Provision via Bluetooth/i })).toBeVisible();
     |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  33 |   });
  34 | 
  35 |   test('toggles BLE flow on /leds', async ({ page }) => {
  36 |     await page.goto('/leds');
  37 |     await page.waitForLoadState('networkidle');
  38 | 
  39 |     await page.getByRole('button', { name: /Provision via Bluetooth/i }).click();
  40 |     await expect(page.getByText(/Provision New Display/i)).toBeVisible();
  41 | 
  42 |     await page.getByRole('button', { name: /Hide Bluetooth/i }).click();
  43 |     await expect(page.getByText(/Provision New Display/i)).not.toBeVisible();
  44 |   });
  45 | 
  46 |   test('scans and lists mock devices in mock mode', async ({ page }) => {
  47 |     await page.goto('/leds');
  48 |     await page.waitForLoadState('networkidle');
  49 | 
  50 |     await page.getByRole('button', { name: /Provision via Bluetooth/i }).click();
  51 |     await page.getByRole('button', { name: /Connect via Bluetooth/i }).click();
  52 | 
  53 |     await expect(page.getByText(/Freq-LED-A1B2/i)).toBeVisible({ timeout: 5000 });
  54 |     await expect(page.getByText(/Freq-Kiosk-C3D4/i)).toBeVisible({ timeout: 5000 });
  55 |   });
  56 | 
  57 |   test('connects to a mock LED display and provisions Wi-Fi', async ({ page }) => {
  58 |     await page.goto('/leds');
  59 |     await page.waitForLoadState('networkidle');
  60 | 
  61 |     await page.getByRole('button', { name: /Provision via Bluetooth/i }).click();
  62 |     await page.getByRole('button', { name: /Connect via Bluetooth/i }).click();
  63 | 
  64 |     await expect(page.getByText(/Freq-LED-A1B2/i)).toBeVisible({ timeout: 5000 });
  65 |     await page.getByRole('button', { name: /Connect/i }).first().click();
  66 | 
  67 |     await expect(page.getByText(/Device Type/i)).toBeVisible({ timeout: 5000 });
  68 |     await expect(page.getByText(/LED_DISPLAY/i)).toBeVisible();
  69 | 
  70 |     await page.getByRole('button', { name: /Scan Wi-Fi Networks/i }).click();
  71 |     await expect(page.getByText(/Office-WiFi/i)).toBeVisible({ timeout: 5000 });
  72 | 
  73 |     await page.getByLabel('Wi-Fi Network').selectOption('Office-WiFi');
  74 |     await page.getByLabel('Password').fill('secret123');
  75 |     await page.getByRole('button', { name: /Configure Wi-Fi/i }).click();
  76 | 
  77 |     await expect(page.getByText(/Provisioning.../i)).toBeVisible({ timeout: 5000 });
  78 |     await expect(page.getByText(/Wi-Fi connected/i)).toBeVisible({ timeout: 10000 });
  79 |   });
  80 | });
  81 | 
```