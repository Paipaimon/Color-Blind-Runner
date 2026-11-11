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
  await expect(page.locator('#actionBtn')).toHaveText('再来一局');
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
  await expect(a.locator('#actionBtn')).toHaveText('再来一局');
  await a.locator('#findNewRoom').click();
  await expect(a.locator('#gameCanvas')).toHaveAttribute('data-game-state', 'WAITING');
  await expect(a.locator('#roundResult')).toBeHidden();
  await context.close();
});


test('tapping a visible obstacle warns its teammate and displays the round goal', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await context.newPage(); const b = await context.newPage();
  let state;
  let otherState;
  b.on('websocket', socket => socket.on('framereceived', frame => {
    const message = JSON.parse(String(frame.payload));
    if (message.type === 'GAME_STATE') otherState = message.state;
  }));
  a.on('websocket', socket => socket.on('framereceived', frame => {
    const message = JSON.parse(String(frame.payload));
    if (message.type === 'GAME_STATE') state = message.state;
  }));
  await a.goto('http://127.0.0.1:8788'); await b.goto('http://127.0.0.1:8788');
  await a.locator('#actionBtn').click(); await b.locator('#actionBtn').click();
  await expect(a.locator('#roundPhase')).toContainText('热身');
  await expect(a.locator('#roundGoal')).toContainText('目标 30m');
  const visible = snapshot => snapshot?.obstacles.find(o => o.position.y > 90 && o.position.y < 500);
  await expect.poll(() => Boolean(visible(state) || visible(otherState)), { timeout: 15000 }).toBe(true);
  const sender = visible(state) ? a : b;
  const recipient = sender === a ? b : a;
  const obstacle = visible(sender === a ? state : otherState);
  const canvas = sender.locator('#gameCanvas');
  const point = await canvas.evaluate((element, obstacle) => {
    const rect = element.getBoundingClientRect();
    const scale = Number(element.dataset.scale || 1);
    const offset = Number(element.dataset.offsetX ?? (element.width - 180) / 2);
    return {
      x: rect.left + (offset + (obstacle.position.x + 30) * scale) * rect.width / element.width,
      y: rect.top + (obstacle.position.y + 12) * rect.height / element.height
    };
  }, obstacle);
  await sender.mouse.click(point.x, point.y);
  await expect(recipient.locator('#teamWarning')).toContainText('队友提醒');
  await expect(sender.locator('#teamWarning')).toContainText('已提醒');
  await recipient.screenshot({ path: testInfo.outputPath('teammate-warning.png') });
  await expect(recipient.locator('#teamWarning')).toBeHidden({ timeout: 2500 });
  await recipient.close();
  await expect(sender.locator('#roundReview')).toContainText('已提醒队友 1 次');
  await context.close();
});

test('rematch keeps the result until everyone is ready and resets presentation for round two', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  await context.addInitScript(() => {
    localStorage.setItem('colorBlindRunner_personalBest', '100');
    Element.prototype.requestFullscreen = undefined;
  });
  const page = await context.newPage();
  let socket;
  const sent = [];
  const players = [
    { id: 'me', color: 'RED', position: { x: 90, y: 0 }, isAlive: true, lives: 3, distance: 0, survivalTime: 0, totalMoves: 0 },
    { id: 'friend', color: 'BLUE', position: { x: 90, y: 0 }, isAlive: true, lives: 3, distance: 0, survivalTime: 0, totalMoves: 0 }
  ];
  const state = { players, obstacles: [], powerUps: [], scrollSpeed: 3, gameState: 'PLAYING', phase: 'warmup', remainingSeconds: 90 };
  const send = message => socket.send(JSON.stringify(message));
  await page.routeWebSocket('**/*', ws => {
    socket = ws;
    ws.onMessage(raw => {
      const message = JSON.parse(String(raw));
      sent.push(message);
      if (message.type === 'JOIN_ROOM') {
        send({ type: 'ROOM_JOINED', roomId: 'party', playerId: 'me', playerColor: 'RED', players });
        send({ type: 'ROOM_STATE', state: { ...state, gameState: 'WAITING' } });
      } else if (message.type === 'READY') {
        if (sent.filter(m => m.type === 'READY').length === 1) {
          send({ type: 'GAME_START' });
          send({ type: 'GAME_STATE', state, timestamp: Date.now() });
        } else {
          send({ type: 'ROOM_STATE', state: { ...state, gameState: 'GAME_OVER', players: players.map(p => ({ ...p, ready: p.id === 'me' })) } });
        }
      }
    });
  });
  await page.goto('http://127.0.0.1:8788');
  await page.locator('#actionBtn').tap();
  await expect(page.locator('#roundGoal')).toContainText('目标 101m');
  send({ type: 'GAME_OVER', winners: ['friend'], finalState: {
    ...state, gameState: 'GAME_OVER', players: players.map(p => ({ ...p, distance: 42, survivalTime: 14,
      isAlive: p.id !== 'me', lives: p.id === 'me' ? 0 : 3, lastDamage: { route: 1, distance: 42 } }))
  } });
  await expect(page.locator('#roundReview')).toContainText('还差 58.0m');
  await expect(page.locator('#roundReview')).toContainText('最后受伤在中路');
  await page.screenshot({ path: testInfo.outputPath('rematch-mobile.png') });
  await page.locator('#actionBtn').tap();
  await expect(page.locator('#actionHint')).toHaveText('原房间再战 · 1/2 已准备');
  await expect(page.locator('[data-slot="result-distance-value"]')).toHaveText('42.0m');
  send({ type: 'COUNTDOWN', seconds: 2 });
  await expect(page.locator('#roundReview')).toBeHidden();
  send({ type: 'GAME_START' });
  send({ type: 'GAME_STATE', state, timestamp: Date.now() });
  await expect(page.locator('#lives')).toHaveText('♥♥♥');
  await expect(page.locator('#liveDistance')).toHaveText('0.0m');
  await expect(page.locator('#roundGoal')).toContainText('目标 101m');
  expect(sent.filter(m => m.type === 'JOIN_ROOM')).toHaveLength(1);
  await context.close();
});
