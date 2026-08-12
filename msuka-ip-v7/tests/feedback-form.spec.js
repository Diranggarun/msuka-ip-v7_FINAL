// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP — Feedback Form UI Suite
//  Chapter 3: System Testing — evaluation questionnaire (feedback.html)
//
//  Drives the public 5-point Likert feedback form end to end: rendering,
//  client-side validation, a full submission, and the result modal that
//  feeds the Chapter-4 weighted-mean analysis.
//
//  Run with:  npm test -- feedback-form
// ═══════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');

// Override with BASE_URL=http://localhost:3100 to run against a scratch server
// (e.g. one started with SQLITE_PATH set) instead of the live one on :3000.
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Question counts per section — see feedback.html `sections` object.
const SECTIONS = { a: 5, b: 7, c: 5, d: 5 };
const TOTAL_QUESTIONS = Object.values(SECTIONS).reduce((a, b) => a + b, 0); // 22

// Clicks the Likert label for every question. Radio <input>s are
// display:none, so we click the visible <label for="..."> instead.
async function answerAll(page, value) {
  for (const [sec, count] of Object.entries(SECTIONS)) {
    for (let i = 0; i < count; i++) {
      await page.click(`label[for="q_${sec}_${i}_${value}"]`);
    }
  }
}

test.describe('12. Feedback Form — rendering & validation', () => {

  test('12.1 form renders all 22 questions across 4 sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    await expect(page.locator('.question-row')).toHaveCount(TOTAL_QUESTIONS);
    for (const sec of Object.keys(SECTIONS)) {
      await expect(page.locator(`#section-${sec} .question-row`)).toHaveCount(SECTIONS[sec]);
    }
    console.log(`✅ Rendered ${TOTAL_QUESTIONS} questions across 4 sections`);
  });

  test('12.2 date field defaults to today', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    const today = new Date().toISOString().slice(0, 10);
    await expect(page.locator('#resp-date')).toHaveValue(today);
    console.log('✅ Date pre-filled with today');
  });

  // 12.3/12.4 assert the inline message, not a dialog. Validation moved off
  // alert() because iOS offers "Suppress dialogs" on repeated alerts, and once a
  // respondent taps it every later prompt is swallowed silently.
  test('12.3 submitting without a respondent type is blocked', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    let dialogAppeared = false;
    page.on('dialog', d => { dialogAppeared = true; d.dismiss(); });
    await page.click('.btn-submit');
    await expect(page.locator('.field-error')).toHaveText(/respondent type/i);
    await expect(page.locator('#resp-type')).toHaveClass(/field-invalid/);
    await expect(page.locator('#result-overlay')).not.toHaveClass(/open/);
    expect(dialogAppeared, 'validation must not use a blocking dialog').toBe(false);
    console.log('✅ Missing respondent type blocks submission (inline)');
  });

  test('12.4 submitting with unanswered questions is blocked', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    await page.selectOption('#resp-type', 'Faculty Member');
    await page.selectOption('#resp-device', 'Desktop/Laptop (Windows)');
    let dialogAppeared = false;
    page.on('dialog', d => { dialogAppeared = true; d.dismiss(); });
    await page.click('.btn-submit');
    // the message is attached to the first unanswered question, not the page top
    await expect(page.locator('.field-error')).toHaveText(/answer this question/i);
    await expect(page.locator('.question-row.field-invalid')).toHaveCount(1);
    await expect(page.locator('#result-overlay')).not.toHaveClass(/open/);
    expect(dialogAppeared, 'validation must not use a blocking dialog').toBe(false);
    console.log('✅ Unanswered questions block submission (inline)');
  });

});

test.describe('13. Feedback Form — full submission', () => {

  test('13.1 all-5 submission yields a 5.00 "Strongly Agree" result', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    await page.fill('#resp-name', `PW Feedback ${Date.now()}`);
    await page.selectOption('#resp-type', 'Student (4th Year IT/CS)');
    await page.selectOption('#resp-device', 'Desktop/Laptop (Windows)');

    await answerAll(page, 5);
    await page.click('.btn-submit');

    await expect(page.locator('#result-overlay')).toHaveClass(/open/);
    await expect(page.locator('#res-overall')).toHaveText('5.00');
    await expect(page.locator('#res-interpretation')).toContainText('Strongly Agree');
    // One breakdown row per section
    await expect(page.locator('.result-row')).toHaveCount(4);
    console.log('✅ All-5 submission → 5.00 Strongly Agree');
  });

  test('13.2 all-3 submission yields a 3.00 "Neutral" result', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    await page.selectOption('#resp-type', 'Student (3rd Year IT/CS)');
    await page.selectOption('#resp-device', 'Android Smartphone');

    await answerAll(page, 3);
    await page.click('.btn-submit');

    await expect(page.locator('#result-overlay')).toHaveClass(/open/);
    await expect(page.locator('#res-overall')).toHaveText('3.00');
    await expect(page.locator('#res-interpretation')).toContainText('Neutral');
    console.log('✅ All-3 submission → 3.00 Neutral');
  });

  test('13.3 submission persists to the server (POST /api/survey)', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    await page.selectOption('#resp-type', 'Faculty Member');
    await page.selectOption('#resp-device', 'Tablet');
    await answerAll(page, 4);

    // Confirm the form actually fires the persistence request.
    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().endsWith('/api/survey') && r.method() === 'POST'),
      page.click('.btn-submit'),
    ]);
    const payload = request.postDataJSON();
    expect(payload.type).toBe('Faculty Member');
    expect(payload.overall).toBe(4);
    await expect(page.locator('#result-overlay')).toHaveClass(/open/);
    console.log('✅ Submission POSTed to /api/survey with overall=4');
  });

  test('13.5 the optional comment is sent, stored and readable on a solid card', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    await page.selectOption('#resp-type', 'Student (4th Year IT/CS)');
    await page.selectOption('#resp-device', 'Android Smartphone');

    // The card must be opaque. Every section on this page sits over the MSU
    // gate photograph, and a section built with the wrong classes renders with
    // the photo showing through its own text — which is how this one shipped
    // the first time.
    const bg = await page.evaluate(() =>
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      getComputedStyle(document.querySelector('#resp-notes').closest('.section-card')).backgroundColor);
    expect(bg, 'the comment card is transparent over the background photo').not.toMatch(/rgba\(0, 0, 0, 0\)/);

    const note = 'Voice calls worked, but 5MB uploads were tight. Commas, "quotes" and all.';
    await page.fill('#resp-notes', note);
    await expect(page.locator('#note-count')).toHaveText(`${note.length} / 1000`);

    await answerAll(page, 5);
    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().endsWith('/api/survey') && r.method() === 'POST'),
      page.click('.btn-submit'),
    ]);
    expect(request.postDataJSON().notes).toBe(note);
    console.log('✅ Comment sent with the submission and its card is opaque');
  });

  test('13.6 the comment is optional', async ({ page }) => {
    // A required comment would cost responses, and a forced one is rarely real.
    await page.goto(`${BASE_URL}/feedback.html`);
    await page.selectOption('#resp-type', 'Student (3rd Year IT/CS)');
    await page.selectOption('#resp-device', 'Desktop/Laptop (Windows)');
    await answerAll(page, 4);
    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().endsWith('/api/survey') && r.method() === 'POST'),
      page.click('.btn-submit'),
    ]);
    expect(request.postDataJSON().notes).toBeNull();
    await expect(page.locator('#result-overlay')).toHaveClass(/open/);
    console.log('✅ Submitting with no comment still works');
  });

  test('13.4 result modal closes via the Close button', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    await page.selectOption('#resp-type', 'CICS Network Administrator');
    await page.selectOption('#resp-device', 'Desktop/Laptop (Windows)');
    await answerAll(page, 5);
    await page.click('.btn-submit');
    await expect(page.locator('#result-overlay')).toHaveClass(/open/);

    await page.click('.btn-close-result');
    await expect(page.locator('#result-overlay')).not.toHaveClass(/open/);
    console.log('✅ Result modal closes correctly');
  });

});
