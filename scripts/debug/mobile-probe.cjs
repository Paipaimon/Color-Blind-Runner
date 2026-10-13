/**
 * 调试辅助脚本（不参与构建与游戏运行）
 * 作用：以移动端（竖屏触控）仿真打开游戏，核验：
 *   1) 画布实际渲染盒 vs 内部分辨率是否等比（显示是否变形/溢出）
 *   2) 在画布上滑动后，客户端是否真的把移动输入发送到服务器
 * 用法：node scripts/debug/mobile-probe.cjs [宽] [高]
 * 前置：服务器已运行（默认 8000），且 Edge/Chrome 已以 --remote-debugging-port=9222 启动。
 */

const fs = require('fs');
const http = require('http');
const { WebSocket } = require('ws');

const W = Number(process.argv[2] || 390);
const H = Number(process.argv[3] || 844);
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const PAGE_URL = process.env.PAGE_URL || 'http://localhost:8000/?autoplay=1';
const OUT = process.env.OUT || '.markdown-collab/mobile-probe.png';

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function putJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: CDP_PORT, path, method: 'PUT' }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function findPageTarget() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const targets = await getJson('/json/list');
      const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      const page = pages.find((t) => /^https?:/.test(t.url)) || pages[0];
      if (page) return page;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('未找到可用的页面目标');
}

function createClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { ready, send, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HOOK = `
window.__SENT__ = [];
(function(){
  var orig = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data){
    try { window.__SENT__.push({ t: Date.now(), data: String(data) }); } catch(e){}
    return orig.apply(this, arguments);
  };
})();
`;

(async () => {
  const target = await findPageTarget();
  const c = createClient(target.webSocketDebuggerUrl);
  await c.ready;

  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 3, mobile: true,
    screenWidth: W, screenHeight: H
  });
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await c.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l'
  });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });

  await c.send('Page.navigate', { url: PAGE_URL });

  // 等待进入 PLAYING
  const deadline = Date.now() + 30000;
  let state = 'unknown';
  while (Date.now() < deadline) {
    const res = await c.send('Runtime.evaluate', {
      expression: '(function(){var x=document.getElementById("gameCanvas");return x&&x.dataset.gameState?x.dataset.gameState:"none";})()',
      returnByValue: true
    });
    state = res.result.value;
    if (state === 'PLAYING') break;
    await sleep(250);
  }
  await sleep(600);

  const probe = await c.send('Runtime.evaluate', {
    expression: `(function(){
      var cv = document.getElementById('gameCanvas');
      var r = cv.getBoundingClientRect();
      var st = document.querySelector('.game-stage').getBoundingClientRect();
      var bar = document.getElementById('statusBar').getBoundingClientRect();
      var wrap = document.querySelector('.game-wrapper').getBoundingClientRect();
      var foot = document.querySelector('.game-footer').getBoundingClientRect();
      var dispW = parseFloat(cv.style.width) || r.width;
      var dispH = parseFloat(cv.style.height) || r.height;
      return JSON.stringify({
        viewport: window.innerWidth + 'x' + window.innerHeight,
        visualViewport: (window.visualViewport ? window.visualViewport.width + 'x' + window.visualViewport.height : '-'),
        gameState: cv.dataset.gameState,
        layoutMode: cv.dataset.layout,
        dataDisplay: cv.dataset.displayWidth + 'x' + cv.dataset.displayHeight,
        internalRes: cv.width + 'x' + cv.height,
        rect: Math.round(r.width) + 'x' + Math.round(r.height),
        rectTop: Math.round(r.top), rectBottom: Math.round(r.bottom),
        styleWH: cv.style.width + ' / ' + cv.style.height,
        rectRatio: +(r.width / r.height).toFixed(4),
        internalRatio: +(cv.width / cv.height).toFixed(4),
        stage: Math.round(st.width) + 'x' + Math.round(st.height),
        stageTop: Math.round(st.top), stageBottom: Math.round(st.bottom),
        statusBar: Math.round(bar.width) + 'x' + Math.round(bar.height),
        wrapper: Math.round(wrap.width) + 'x' + Math.round(wrap.height),
        footerTop: Math.round(foot.top),
        canvasClippedTop: Math.round(st.top - r.top),
        canvasClippedBottom: Math.round(r.bottom - st.bottom),
        overflowY: document.documentElement.scrollHeight > window.innerHeight,
        bodyScrollH: document.body.scrollHeight
      });
    })()`,
    returnByValue: true
  });
  const metrics = JSON.parse(probe.result.value);

  // 取画布中心做一次向右滑动（慢速，模拟真实手机拖动）
  const rectRes = await c.send('Runtime.evaluate', {
    expression: '(function(){var r=document.getElementById("gameCanvas").getBoundingClientRect();return JSON.stringify({l:r.left,t:r.top,w:r.width,h:r.height});})()',
    returnByValue: true
  });
  const rect = JSON.parse(rectRes.result.value);
  const cy = Math.min(rect.t + rect.h * 0.6, H - 10);
  const startX = rect.l + rect.w * 0.30;
  const endX = rect.l + rect.w * 0.70;

  const touch = (type, x, y) => c.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), radiusX: 8, radiusY: 8, force: 1 }],
    changedTouchPoints: type === 'touchEnd' ? [{ x: Math.round(x), y: Math.round(y), radiusX: 8, radiusY: 8, force: 1 }] : undefined
  });

  const before = await c.send('Runtime.evaluate', { expression: 'window.__SENT__.length', returnByValue: true });

  // 1) 一次短促右滑（< 200ms，确保被识别为滑动）
  await touch('touchStart', startX, cy);
  await sleep(50);
  await touch('touchMove', (startX + endX) * 0.5, cy);
  await sleep(50);
  await touch('touchMove', endX, cy);
  await sleep(50);
  await touch('touchEnd', endX, cy);
  await sleep(200);

  // 2) 在画布左 1/4 区域做一次短促轻触，验证 tap-zone 兜底
  const leftTapX = rect.l + rect.w * 0.15;
  await touch('touchStart', leftTapX, cy);
  await sleep(40);
  await touch('touchEnd', leftTapX, cy);
  await sleep(200);

  const sentAfter = await c.send('Runtime.evaluate', {
    expression: `JSON.stringify(window.__SENT__.slice(${before.result.value}).map(function(e){
      var o; try { o = JSON.parse(e.data); } catch(err) { o = { raw: e.data }; }
      return o.type ? (o.type + (o.input ? ':' + JSON.stringify(o.input) : '')) : JSON.stringify(o);
    }))`,
    returnByValue: true
  });

  const shot = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));

  console.log('STATE=' + state);
  console.log('METRICS=' + JSON.stringify(metrics, null, 2));
  console.log('SENT_AFTER_SWIPE=' + sentAfter.result.value);
  const all = await c.send('Runtime.evaluate', {
    expression: `JSON.stringify(window.__SENT__.map(function(e){
      var o; try { o = JSON.parse(e.data); } catch(err) { o = { raw: e.data }; }
      return o.type ? (o.type + (o.input ? ':' + JSON.stringify(o.input) : '')) : JSON.stringify(o);
    }))`,
    returnByValue: true
  });
  console.log('SENT_ALL=' + all.result.value);
  console.log('SAVED=' + OUT);
  c.close();
  process.exit(0);
})().catch((err) => {
  console.error('移动端探针失败:', err.message);
  process.exit(1);
});
