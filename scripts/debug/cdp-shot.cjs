/**
 * 调试辅助脚本（不参与构建与游戏运行）
 * 作用：通过 Chrome DevTools Protocol 连接无头浏览器，等待页面进入指定状态后截图。
 * 用法：node .markdown-collab/cdp-shot.js <输出文件> [等待毫秒] [gameState]
 *   - gameState 取值：任意 / PLAYING / GAME_OVER（大写，匹配页面内 gameCanvas.dataset.gameState）
 */

const fs = require('fs');
const http = require('http');
const { WebSocket } = require('ws');

const OUT = process.argv[2] || '.markdown-collab/cdp-shot.png';
const WAIT_MS = Number(process.argv[3] || 6000);
const WANT_STATE = process.argv[4] || 'any';
const CDP_PORT = Number(process.env.CDP_PORT || 9222);

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function findPageTarget() {
  const deadline = Date.now() + 20000;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const targets = await getJson('/json/list');
      // 优先选择真正的网页标签（排除 edge:// 引导页、扩展后台页等）
      const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      const httpPage = pages.find((t) => /^https?:/.test(t.url));
      const page = httpPage || pages.find((t) => !/^edge:\/\//.test(t.url)) || pages[0];
      if (page) return page;
    } catch (e) {
      lastError = e.message;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`未找到可用的页面目标（最后错误：${lastError || '无'}）`);
}

function createClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });

  const ready = new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return { ready, send, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const target = await findPageTarget();
  const client = createClient(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Runtime.enable');

  const deadline = Date.now() + WAIT_MS;
  let state = 'unknown';

  while (Date.now() < deadline) {
    const res = await client.send('Runtime.evaluate', {
      expression: '(function(){var c=document.getElementById("gameCanvas");return c&&c.dataset.gameState?c.dataset.gameState:"no-canvas";})()',
      returnByValue: true
    });
    state = res.result.value;
    if (WANT_STATE === 'any' || state === WANT_STATE) break;
    await sleep(200);
  }

  await sleep(250);

  const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));

  const info = await client.send('Runtime.evaluate', {
    expression: `JSON.stringify({
      gameState: document.getElementById("gameCanvas")?.dataset.gameState,
      status: document.getElementById("statusBar")?.textContent?.replace(/\\s+/g," ").trim(),
      button: document.getElementById("actionBtn")?.textContent,
      hint: document.getElementById("actionHint")?.textContent
    })`,
    returnByValue: true
  });

  console.log('STATE=' + state);
  console.log('INFO=' + info.result.value);
  console.log('SAVED=' + OUT);
  client.close();
  process.exit(0);
})().catch((err) => {
  console.error('CDP 截图失败:', err.message);
  process.exit(1);
});
