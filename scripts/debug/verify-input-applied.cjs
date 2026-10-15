/**
 * 调试辅助脚本（不参与构建与游戏运行）
 *
 * 作用：用两个脚本客户端开局，其中一个发送 PLAYER_INPUT，并打印服务器 GAME_STATE 里
 *      该玩家 position.x 的变化，用来判断「输入是否被服务端接受并生效」。
 *
 * 用法：node scripts/debug/verify-input-applied.cjs [host]
 */

const { WebSocket } = require('ws');

const HOST = process.argv[2] || 'localhost:8000';
const URL = `ws://${HOST}`;
const CELL = 60;

function makeClient(name) {
  const ws = new WebSocket(URL);
  const client = {
    name,
    ws,
    playerId: null,
    color: null,
    x: null,
    route: null,
    states: 0,
    ready: false
  };

  ws.on('open', () => ws.send(JSON.stringify({ type: 'JOIN_ROOM' })));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'ROOM_JOINED') {
      client.playerId = msg.playerId;
      client.color = msg.playerColor;
      console.log(`[${name}] 加入房间 ${msg.roomId} 颜色 ${msg.playerColor}`);
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'READY' }));
        client.ready = true;
      }, 400);
    }

    if (msg.type === 'GAME_START') {
      console.log(`[${name}] 游戏开始`);
    }

    if (msg.type === 'GAME_STATE') {
      const me = msg.state.players.find((p) => p.id === client.playerId);
      if (me) {
        client.states++;
        const newX = me.position.x;
        const newRoute = Math.floor(newX / CELL);
        if (client.route === null) {
          client.route = newRoute;
          console.log(`[${name}] 初始 route=${newRoute} x=${newX} alive=${me.isAlive}`);
        } else if (newRoute !== client.route) {
          console.log(`[${name}] route 变化 ${client.route} -> ${newRoute} (x=${newX})`);
          client.route = newRoute;
        }
        client.x = newX;
      }
    }

    if (msg.type === 'ERROR') {
      console.log(`[${name}] 服务端错误 ${msg.code}: ${msg.message}`);
    }
  });

  ws.on('error', (err) => console.error(`[${name}] ws 错误: ${err.message}`));

  return client;
}

function sendInput(client, input) {
  if (client.ws.readyState !== WebSocket.OPEN) return;
  client.ws.send(JSON.stringify({ type: 'PLAYER_INPUT', input }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const a = makeClient('A');
  await sleep(300);
  const b = makeClient('B'); // 凑够 MIN_PLAYERS

  await sleep(4000);

  console.log('--- 发送 LEFT ---');
  const routeBefore = a.route;
  sendInput(a, { up: false, down: false, left: true, right: false });
  await sleep(200);
  sendInput(a, { up: false, down: false, left: false, right: false });
  await sleep(1200);
  const routeAfterLeft = a.route;

  console.log('--- 发送 RIGHT ---');
  sendInput(a, { up: false, down: false, left: false, right: true });
  await sleep(200);
  sendInput(a, { up: false, down: false, left: false, right: false });
  await sleep(1200);
  const routeAfterRight = a.route;

  console.log('==== 结果 ====');
  console.log(`A 收到状态帧: ${a.states}`);
  console.log(`route 初始=${routeBefore} 左移后=${routeAfterLeft} 右移后=${routeAfterRight}`);
  console.log(`输入生效: ${routeAfterLeft !== routeBefore || routeAfterRight !== routeAfterLeft ? 'YES' : 'NO'}`);

  for (const c of [a, b]) c.ws.close();
  process.exit(0);
})().catch((e) => {
  console.error('失败:', e.message);
  process.exit(1);
});
