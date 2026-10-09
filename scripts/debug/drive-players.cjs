/**
 * 调试辅助脚本（不参与构建与游戏运行）
 * 作用：向本地服务器投放 N 个「脚本玩家」并全部准备，让房间凑够人数自动开局，
 *      便于用无头浏览器截图核验游戏进行中的 UI。
 * 用法：node .markdown-collab/drive-players.js [玩家数] [存活毫秒] [readyDelayMs]
 *   - readyDelayMs 传 -1 表示不自动准备（用于停留在等待阶段核验大厅 UI）
 */

const { WebSocket } = require('ws');

const PLAYER_COUNT = Number(process.argv[2] || 2);
const ALIVE_MS = Number(process.argv[3] || 20000);
const READY_DELAY = process.argv[4] !== undefined ? Number(process.argv[4]) : null;
const URL = process.env.WS_URL || 'ws://localhost:8000';

const sockets = [];

function createPlayer(index) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    sockets.push(ws);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'JOIN_ROOM' }));
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'ROOM_JOINED') {
        console.log(`[player${index}] 加入房间 ${msg.roomId} 颜色 ${msg.playerColor}`);
        // 稍等片刻，等浏览器端也进入房间后再准备；READY_DELAY < 0 表示只占位不准备
        const delay = READY_DELAY === null ? 1500 + index * 120 : READY_DELAY;
        if (delay >= 0) {
          setTimeout(() => ws.send(JSON.stringify({ type: 'READY' })), delay);
        }
        resolve();
      }

      if (msg.type === 'GAME_START') {
        console.log(`[player${index}] 游戏开始`);
      }

      if (msg.type === 'PLAYER_DIED') {
        console.log(`[player${index}] 收到死亡广播: ${msg.playerId}`);
      }

      if (msg.type === 'GAME_OVER') {
        console.log(`[player${index}] 游戏结束`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[player${index}] 错误:`, err.message);
    });
  });
}

(async () => {
  console.log(`投放 ${PLAYER_COUNT} 个脚本玩家 → ${URL}`);
  for (let i = 0; i < PLAYER_COUNT; i++) {
    await createPlayer(i + 1);
  }

  // 开局后让脚本玩家随机切换路线，制造真实的对局画面
  const mover = setInterval(() => {
    for (const ws of sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const goLeft = Math.random() < 0.5;
      ws.send(JSON.stringify({
        type: 'PLAYER_INPUT',
        input: { up: false, down: false, left: goLeft, right: !goLeft }
      }));
      ws.send(JSON.stringify({
        type: 'PLAYER_INPUT',
        input: { up: false, down: false, left: false, right: false }
      }));
    }
  }, 700);

  setTimeout(() => {
    clearInterval(mover);
    console.log('脚本玩家退出');
    for (const ws of sockets) ws.close();
    process.exit(0);
  }, ALIVE_MS);
})();
