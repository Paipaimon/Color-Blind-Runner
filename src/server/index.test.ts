import { GameLoop, GameRoom } from './game-loop.js';
import { PlayerColor } from '../shared/types.js';
import { afterEach, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { GameServer, readPublicFile } from './index.js';
import { ServerMessage } from '../shared/messages.js';

let server: GameServer;
const clients: WebSocket[] = [];
afterEach(async () => { clients.forEach(client => client.terminate()); clients.length = 0; await server?.close(); vi.restoreAllMocks(); });
async function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
  clients.push(ws);
  const inbox: ServerMessage[] = [];
  ws.on('message', data => inbox.push(JSON.parse(data.toString())));
  await new Promise<void>(resolve => ws.once('open', resolve));
  return { ws, inbox, send: (type: string, fields = {}) => ws.send(JSON.stringify({ type, ...fields })) };
}
async function until(check: () => boolean) {
  const deadline = Date.now() + 6000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for server event');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

it('synchronizes ready, cancels countdown on departure, then sends authoritative final stats', async () => {
  server = new GameServer(0, '127.0.0.1');
  await server.ready;
  const a = await client(); const b = await client();
  a.send('JOIN_ROOM'); b.send('JOIN_ROOM');
  await until(() => b.inbox.some(m => m.type === 'ROOM_JOINED'));
  a.send('READY');
  await until(() => b.inbox.some(m => m.type === 'ROOM_STATE' && m.state.players.filter(p => p.ready).length === 1));
  b.send('READY');
  await until(() => a.inbox.some(m => m.type === 'COUNTDOWN'));
  b.ws.close();
  await until(() => a.inbox.some(m => m.type === 'ROOM_STATE' && m.state.players.length === 1 && !m.state.players[0].ready));
  const c = await client(); c.send('JOIN_ROOM');
  await until(() => c.inbox.some(m => m.type === 'ROOM_JOINED'));
  a.send('READY'); c.send('READY');
  await until(() => a.inbox.some(m => m.type === 'GAME_STATE'));
  const first = a.inbox.findLast(m => m.type === 'GAME_STATE');
  if (first?.type !== 'GAME_STATE') throw new Error('Missing game state');
  const joined = a.inbox.find(m => m.type === 'ROOM_JOINED');
  if (joined?.type !== 'ROOM_JOINED') throw new Error('Missing identity');
  expect(first.state.players.every(p => p.lives === 3)).toBe(true);
  expect(first.state.obstacles.every(o => String(o.color) !== String(joined.playerColor))).toBe(true);
  a.send('PLAYER_INPUT', { input: { up: false, down: false, left: true, right: false } });
  await until(() => a.inbox.some(m => m.type === 'GAME_STATE' && m.state.players.some(p => p.id === joined.playerId && p.totalMoves === 1)));
  c.ws.close();
  await until(() => a.inbox.some(m => m.type === 'GAME_OVER'));
  const final = a.inbox.find(m => m.type === 'GAME_OVER');
  if (final?.type !== 'GAME_OVER') throw new Error('Missing final state');
  expect(final.winners).toEqual([joined.playerId]);
  expect(final.finalState.players.every(p => (p.distance ?? 0) > 0 && (p.survivalTime ?? 0) > 0)).toBe(true);
  a.send('JOIN_ROOM');
  await until(() => a.inbox.filter(m => m.type === 'ROOM_JOINED').length === 2);
});

it('serves public assets and confines file access to public roots', async () => {
  expect((await readPublicFile('/')).mime).toContain('text/html');
  expect((await readPublicFile('/dist/client/index.js')).mime).toContain('javascript');
  for (const url of ['/dist/server/index.js', '/dist/client/../../package.json', '/%2e%2e/package.json', '/package.json']) {
    await expect(readPublicFile(url)).rejects.toThrow();
  }
});

it('delivers validated warnings and restarts the same connected party with fresh round state', async () => {
  let currentRound: GameRoom | undefined;
  const originalStart = GameLoop.prototype.start;
  vi.spyOn(GameLoop.prototype, 'start').mockImplementation(function (this: GameLoop, room: GameRoom) {
    currentRound = room;
    originalStart.call(this, room);
  });
  server = new GameServer(0, '127.0.0.1');
  await server.ready;
  const a = await client(); const b = await client();
  a.send('JOIN_ROOM'); b.send('JOIN_ROOM');
  await until(() => b.inbox.some(m => m.type === 'ROOM_JOINED'));
  a.send('READY'); b.send('READY');
  await until(() => a.inbox.some(m => m.type === 'GAME_STATE'));
  const room = currentRound!;
  const identity = room.players.map(p => [p.id, p.color]);
  room.obstacles.push({ id: 'obstacle_900', color: PlayerColor.BLUE, route: 2, y: room.worldPosition + 2 });
  a.send('WARN_OBSTACLE', { obstacleId: 'obstacle_900' });
  await until(() => b.inbox.some(m => m.type === 'TEAM_WARNING'));
  expect(room.players[0].warningsSent).toBe(1);
  // A deterministic collision ends the first round while both sockets stay connected.
  room.players[0].lives = 1;
  room.obstacles.push({ id: 'finish', color: PlayerColor.RED, route: 1, y: room.worldPosition + 0.05 });
  await until(() => a.inbox.some(m => m.type === 'GAME_OVER'));
  a.send('READY');
  await until(() => b.inbox.some(m => m.type === 'ROOM_STATE' && m.state.gameState === 'GAME_OVER' && m.state.players[0].ready));
  b.send('READY');
  await until(() => a.inbox.filter(m => m.type === 'GAME_START').length === 2);
  expect(currentRound!.id).toBe(room.id);
  expect(currentRound!.players.map(p => [p.id, p.color])).toEqual(identity);
  expect(currentRound!.players.every(p => p.lives === 3 && p.alive && p.warningsSent === 0 && !p.lastDamage)).toBe(true);
  expect(currentRound!.worldPosition).toBeLessThan(1);
  expect(a.inbox.filter(m => m.type === 'ROOM_JOINED')).toHaveLength(1);
});
