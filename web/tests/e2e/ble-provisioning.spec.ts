import { test, expect, type Page } from '@playwright/test';

function loginIfNeeded(page: Page) {
  return page.goto('/login').then(() => page.waitForLoadState('networkidle'));
}

async function ensureLoggedIn(page: Page) {
  await loginIfNeeded(page);
}

test.describe('BLE Provisioning', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('shows BLE unsupported message when navigator.bluetooth is missing', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as any).navigator.bluetooth;
    });

    await page.goto('/leds');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Bluetooth provisioning is not available/i)).toBeVisible();
  });

  test('shows provision via Bluetooth button on /leds', async ({ page }) => {
    await page.goto('/leds');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /Provision via Bluetooth/i })).toBeVisible();
  });

  test('toggles BLE flow on /leds', async ({ page }) => {
    await page.goto('/leds');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Provision via Bluetooth/i }).click();
    await expect(page.getByText(/Provision New Display/i)).toBeVisible();

    await page.getByRole('button', { name: /Hide Bluetooth/i }).click();
    await expect(page.getByText(/Provision New Display/i)).not.toBeVisible();
  });

  test('scans and lists mock devices in mock mode', async ({ page }) => {
    await page.goto('/leds');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Provision via Bluetooth/i }).click();
    await page.getByRole('button', { name: /Connect via Bluetooth/i }).click();

    await expect(page.getByText(/Freq-LED-A1B2/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Freq-Kiosk-C3D4/i)).toBeVisible({ timeout: 5000 });
  });

  test('connects to a mock LED display and provisions Wi-Fi', async ({ page }) => {
    await page.goto('/leds');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Provision via Bluetooth/i }).click();
    await page.getByRole('button', { name: /Connect via Bluetooth/i }).click();

    await expect(page.getByText(/Freq-LED-A1B2/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Connect/i }).first().click();

    await expect(page.getByText(/Device Type/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/LED_DISPLAY/i)).toBeVisible();

    await page.getByRole('button', { name: /Scan Wi-Fi Networks/i }).click();
    await expect(page.getByText(/Office-WiFi/i)).toBeVisible({ timeout: 5000 });

    await page.getByLabel('Wi-Fi Network').selectOption('Office-WiFi');
    await page.getByLabel('Password').fill('secret123');
    await page.getByRole('button', { name: /Configure Wi-Fi/i }).click();

    await expect(page.getByText(/Provisioning.../i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Wi-Fi connected/i)).toBeVisible({ timeout: 10000 });
  });
});
