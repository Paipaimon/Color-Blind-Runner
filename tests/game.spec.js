import { test, expect } from '@playwright/test';

test('mobile lobby, three lives, button and swipe input, rotation and final score', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // Also verify the supported fallback on mobile browsers without fullscreen.
  await context.addInitScript(() => { Element.prototype.requestFullscreen = undefined; });
  const page = await context.newPage();
  const teammate = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const states = [];
  page.on('websocket', socket => socket.on('framereceived', frame => {
    const message = JSON.parse(String(frame.payload));
    if (message.type === 'GAME_STATE') states.push(message.state);
  }));
  await page.goto('http://127.0.0.1:8788');
  await teammate.goto('http://127.0.0.1:8788');
  await expect(page.locator('#actionBtn')).toBeEnabled();
  await page.locator('#actionBtn').tap();
  await expect(teammate.locator('[data-slot="ready-count-value"]')).toHaveText('1/4');
  await teammate.locator('#actionBtn').tap();
  await expect(page.locator('#gameCanvas')).toHaveAttribute('data-game-state', 'PLAYING');
  await expect(page.locator('#lives')).toHaveText('♥♥♥');
  await expect(page.locator('#mobileControls')).toBeVisible();
  await page.locator('#move-left').tap();
  await expect.poll(() => states.at(-1)?.players.some(p => p.color === 'RED' && p.position.x === 30)).toBe(true);
  const canvas = page.locator('#gameCanvas');
  await canvas.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const start = { identifier: 0, target: element, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [new Touch(start)] }));
    const end = new Touch({ ...start, clientX: start.clientX + 90 });
    element.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [end] }));
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [end] }));
  });
  await expect.poll(() => states.at(-1)?.players.some(p => p.color === 'RED' && p.position.x === 90)).toBe(true);
  const height = (await canvas.boundingBox()).height;
  await page.setViewportSize({ width: 390, height: 700 });
  await expect.poll(async () => (await canvas.boundingBox()).height).toBeLessThan(height);
  await page.screenshot({ path: testInfo.outputPath('mobile-portrait.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(canvas).toHaveAttribute('data-layout', 'mobile-landscape');
  const box = await canvas.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(390);
  const controls = await page.locator('#mobileControls').boundingBox();
  expect(controls.y + controls.height).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('mobile-landscape.png') });
  await teammate.close();
  await expect(page.locator('#roundResult')).toHaveText('你是最后幸存者');
  await expect(page.locator('#actionBtn')).toHaveText('重新开始');
  expect(Number((await page.locator('[data-slot="result-distance-value"]').innerText()).replace('m', ''))).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('desktop keyboard control and clean restart', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await context.newPage(); const b = await context.newPage();
  const states = [];
  a.on('websocket', socket => socket.on('framereceived', frame => {
    const message = JSON.parse(String(frame.payload));
    if (message.type === 'GAME_STATE') states.push(message.state);
  }));
  await a.goto('http://127.0.0.1:8788'); await b.goto('http://127.0.0.1:8788');
  await a.locator('#actionBtn').click(); await b.locator('#actionBtn').click();
  await expect(a.locator('#lives')).toBeVisible();
  await a.keyboard.press('ArrowRight');
  await expect.poll(() => states.at(-1)?.players.some(p => p.color === 'RED' && p.position.x === 150)).toBe(true);
  await a.screenshot({ path: testInfo.outputPath('desktop.png') });
  await b.close();
  await expect(a.locator('#actionBtn')).toHaveText('重新开始');
  await a.locator('#actionBtn').click();
  await expect(a.locator('#gameCanvas')).toHaveAttribute('data-game-state', 'WAITING');
  await expect(a.locator('#roundResult')).toBeHidden();
  await context.close();
});

