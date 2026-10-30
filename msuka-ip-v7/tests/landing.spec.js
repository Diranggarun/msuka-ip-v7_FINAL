// @ts-check
// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 15: Landing page (connection tutorial at "/")
//  Server must already be running. Override with BASE_URL=...
// ═══════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('15. Landing page', () => {

  test('15.1 "/" serves the landing page, not the chat login', async ({ page }) => {
    const resp = await page.goto(BASE_URL);
    expect(resp.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('Chat and Call Anyone on Campus');
    await expect(page.locator('#login-email')).toHaveCount(0);
    console.log('✅ Landing page is the default route');
  });

  test('15.2 Connect Now opens the chat login at /index.html', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('.hero .btn-outline', { hasText: 'Connect Now' }).click();
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(page.locator('#login-email')).toBeVisible();
    console.log('✅ Connect Now reaches the login');
  });

  test('15.3 the tutorial has five steps and shows this server\'s address', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#connect .step')).toHaveCount(5);
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    const origin = await page.evaluate(() => location.origin);
    await expect(page.locator('#server-addr')).toHaveText(origin);
    console.log('✅ Five steps, address box shows', origin);
  });

  test('15.4 FAQ answers open and close', async ({ page }) => {
    await page.goto(BASE_URL);
    const item = page.locator('.faq details').first();
    await expect(item).not.toHaveAttribute('open', '');
    await item.locator('summary').click();
    await expect(item).toHaveAttribute('open', '');
    await expect(item.locator('.ans')).toBeVisible();
    console.log('✅ FAQ accordion works');
  });

  test('15.5 every section link in the nav has a target on the page', async ({ page }) => {
    await page.goto(BASE_URL);
    for (const href of await page.locator('.nav-links a').evaluateAll(as => as.map(a => a.getAttribute('href')))) {
      await expect(page.locator(href)).toHaveCount(1);
    }
    console.log('✅ Nav links all resolve');
  });

  test('15.6 the existing pages still load', async ({ page }) => {
    for (const path of ['/index.html', '/admin.html', '/feedback.html']) {
      const resp = await page.goto(`${BASE_URL}${path}`);
      expect(resp.status(), path).toBe(200);
    }
    console.log('✅ /index.html, /admin.html, /feedback.html still served');
  });
});
