import { afterEach, describe, expect, it } from 'vitest';
import { GameLoop, GameRoom, GameState } from './game-loop.js';
import { PlayerColor } from '../shared/types.js';
import { ObstacleGenerator } from './obstacle-generator.js';

const loops: GameLoop[] = [];
afterEach(() => { for (const loop of loops) for (const id of ['a', 'b']) loop.stop(id); loops.length = 0; });
function setup(id = 'a', colors = [PlayerColor.RED, PlayerColor.BLUE]) {
  let now = 0;
  const loop = new GameLoop({}, () => now);
  loops.push(loop);
  const room: GameRoom = { id, seed: 123, worldPosition: 0, obstacles: [], gameState: GameState.WAITING,
    players: colors.map((color, i) => ({ id: String(i), color, route: 1, alive: true, ready: true, distance: 0 })) };
  loop.start(room);
  const advance = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) { now += 1000 / 60; loop.tick(id); }
  };
  const hit = (id: string) => {
    room.obstacles.push({ id, color: PlayerColor.RED, route: 1, y: room.worldPosition + 0.05 });
    advance(1 / 60);
  };
  return { loop, room, advance, hit };
}

describe('round rules', () => {
  it('starts with three lives, ignores repeat overlap and ends after three distinct hits', () => {
    const { room, loop, advance, hit } = setup();
    expect(room.players[0].lives).toBe(3);
    hit('first');
    expect(room.players[0].lives).toBe(2);
    advance(0.2);
    expect(room.players[0].lives).toBe(2);
    advance(1);
    hit('second');
    expect(room.players[0].lives).toBe(1);
    advance(1.1);
    hit('third');
    expect(room.players[0].alive).toBe(false);
    expect(room.gameState).toBe(GameState.ENDED);
    expect(loop.getRoom(room.id)).toBeNull();
  });

  it('collects a shield once and absorbs one hit', () => {
    const { room, advance, hit } = setup();
    room.powerUps = [{ id: 'shield', kind: 'shield', route: 1, worldY: 0.05, collectedBy: new Set() }];
    advance(1 / 60);
    expect(room.players[0].shield).toBe(true);
    hit('first');
    expect(room.players[0].lives).toBe(3);
    expect(room.players[0].shield).toBe(false);
    advance(0.1);
    expect(room.players[0].shield).toBe(false);
    expect(room.powerUps[0].collectedBy.size).toBe(2);
  });

  it('heals each player once, caps lives, and never revives dead players', () => {
    const { room, advance } = setup('a', [PlayerColor.RED, PlayerColor.BLUE, PlayerColor.GREEN]);
    room.players[0].lives = 2;
    room.players[2].alive = false;
    room.players[2].lives = 0;
    room.powerUps = [{ id: 'heart', kind: 'heart', route: 1, worldY: 0.05, collectedBy: new Set() }];
    advance(1 / 60);
    expect(room.players.map(p => p.lives)).toEqual([3, 3, 0]);
    room.players[0].lives = 2;
    advance(0.1);
    expect(room.players[0].lives).toBe(2);
  });

  it('keeps concurrent rooms deterministic and isolated', () => {
    let now = 0;
    const loop = new GameLoop({}, () => now);
    loops.push(loop);
    const make = (id: string, colors: PlayerColor[]): GameRoom => ({ id, seed: 42, worldPosition: 0,
      gameState: GameState.WAITING, obstacles: [], players: colors.map(color => ({ id: color, color,
        route: 1, alive: true, distance: 0, ready: true })) });
    const a = make('a', [PlayerColor.RED, PlayerColor.BLUE]);
    const b = make('b', [PlayerColor.YELLOW, PlayerColor.GREEN]);
    loop.start(a);
    const initial = [...a.obstacles];
    loop.start(b);
    now = 200;
    loop.tick('a'); loop.tick('b');
    expect(a.obstacles).toEqual(initial);
    expect(a.obstacles.every(o => [PlayerColor.RED, PlayerColor.BLUE].includes(o.color))).toBe(true);
    expect(b.obstacles.every(o => [PlayerColor.YELLOW, PlayerColor.GREEN].includes(o.color))).toBe(true);
    expect(new Set(a.obstacles.map(o => o.id)).size).toBe(a.obstacles.length);
  });

  it('bounds obstacle storage and produces frame-rate-independent sequences', () => {
    const generator = new ObstacleGenerator();
    generator.init(123, [PlayerColor.RED, PlayerColor.BLUE]);
    let obstacles: ReturnType<ObstacleGenerator['generateNext']> = [];
    for (let step = 0; step < 36000; step++) {
      const position = step * 0.05;
      obstacles.push(...generator.generateNext(position));
      obstacles = obstacles.filter(o => o.y > position - 2);
      expect(obstacles.length).toBeLessThanOrEqual(10);
    }
    const other = new ObstacleGenerator();
    other.init(123, [PlayerColor.RED, PlayerColor.BLUE]);
    const all = other.generateNext(1799.95).filter(o => o.y > 1797.95);
    expect(obstacles).toEqual(all);
  });

  it('freezes a disconnected player and clears the round when one remains', () => {
    const { room, loop, advance } = setup('a', [PlayerColor.RED, PlayerColor.BLUE, PlayerColor.GREEN]);
    advance(0.5);
    loop.disconnectPlayer('a', '0');
    const time = room.players[0].survivalTime;
    const distance = room.players[0].distance;
    advance(0.5);
    expect(room.players[0].survivalTime).toBe(time);
    expect(room.players[0].distance).toBe(distance);
    loop.disconnectPlayer('a', '1');
    expect(loop.isRunning('a')).toBe(false);
    expect(loop.getRoom('a')).toBeNull();
  });
});
