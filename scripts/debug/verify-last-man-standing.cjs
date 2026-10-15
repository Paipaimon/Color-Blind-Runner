/**
 * 调试辅助脚本（不参与构建与游戏运行）
 * 作用：验证「最后一名存活玩家产生即结束本局」的规则。
 *
 * 做法：投放 2 名脚本玩家并全部准备，开局后两人都停留在中间车道、
 *      不发任何输入。由于碰撞只发生在同色障碍物上，两人会先后被撞死。
 *      期望日志顺序为：恰好 1 次 PLAYER_DIED → GAME_OVER（winners 含 1 人）。
 *      若仍是旧的「全员阵亡才结束」逻辑，则会看到 2 次 PLAYER_DIED 后才结束。
 *
 * 用法：node scripts/debug/verify-last-man-standing.cjs [超时毫秒]
 */

const { WebSocket } = require('ws');

const TIMEOUT_MS = Number(process.argv[2] || 45000);
const MODE = process.argv[3] || 'idle'; // idle: 原地等撞；disconnect: 开局后让 p2 掉线
const URL = process.env.WS_URL || 'ws://localhost:8000';

const events = [];
const deadIds = new Set();
let started = false;
let finished = false;

function record(line) {
  events.push(line);
  console.log(line);
}

function connect(index) {
  const ws = new WebSocket(URL);

  ws.on('open', () => ws.send(JSON.stringify({ type: 'JOIN_ROOM' })));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'ROOM_JOINED') {
      record(`[p${index}] 加入房间 ${msg.roomId} (${msg.playerColor})`);
      setTimeout(() => ws.send(JSON.stringify({ type: 'READY' })), 300);
    }

    if (msg.type === 'GAME_START') {
      if (!started) {
        started = true;
        record(`[all] GAME_START 对局开始（模式=${MODE}）`);
        if (MODE === 'disconnect') {
          // 开局 1.2s 后让第 2 名玩家直接断开连接，模拟掉线
          setTimeout(() => {
            record('[p2] 主动断开连接（模拟掉线）');
            sockets[1].close();
          }, 1200);
        }
      }
    }

    if (msg.type === 'PLAYER_DIED') {
      deadIds.add(msg.playerId);
      record(`[p${index}] PLAYER_DIED 死亡玩家：${msg.playerId}（累计去重 ${deadIds.size} 人）`);
    }

    if (msg.type === 'GAME_OVER') {
      finished = true;
      record(
        `[p${index}] GAME_OVER winners=[${(msg.winners || []).join(', ')}] ` +
          `死亡人数=${deadIds.size} ` +
          `最终存活=${JSON.stringify(
            (msg.finalState?.players || []).map((p) => ({ c: p.color, alive: p.isAlive }))
          )}`
      );
      setTimeout(() => {
        summarize();
        process.exit(0);
      }, 200);
    }
  });

  ws.on('error', (err) => console.error(`[p${index}] 错误:`, err.message));
  return ws;
}

function summarize() {
  console.log('---------- 判定 ----------');
  const ok = started && deadIds.size === 1 && finished;
  if (ok) {
    console.log('PASS：恰有 1 名玩家死亡即触发 GAME_OVER（最后一人存活）');
  } else {
    console.log(
      `FAIL：started=${started} 死亡人数=${deadIds.size} finished=${finished} → ` +
        '期望 started=true, 死亡人数=1, finished=true'
    );
  }
}

const sockets = [connect(1), connect(2)];

setTimeout(() => {
  if (!finished) record(`[timeout] ${TIMEOUT_MS}ms 内未结束`);
  summarize();
  for (const ws of sockets) ws.close();
  process.exit(finished && deadIds.size === 1 ? 0 : 1);
}, TIMEOUT_MS);
