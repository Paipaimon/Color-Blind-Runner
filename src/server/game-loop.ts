import { phaseAtTime, ROUND_DURATION } from '../shared/round-rules.js';
import { TeamWarning } from '../shared/messages.js';
import { PlayerColor } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';
import { ObstacleGenerator, Obstacle } from './obstacle-generator.js';
import { CollisionDetector, Player } from './collision-detector.js';
import { RouteIndex } from './player-logic.js';
import { PowerUp, PowerUpGenerator } from './power-ups.js';

export enum GameState {
  WAITING = 'waiting',
  PLAYING = 'playing',
  ENDED = 'ended'
}

export interface GameRoom {
  id: string;
  players: Player[];
  obstacles: Obstacle[];
  worldPosition: number;
  gameState: GameState;
  seed: number;
  powerUps?: PowerUp[];
  elapsed?: number;
  endReason?: 'last_survivor' | 'time_limit';
}

export interface PlayerScore {
  id: string;
  color: PlayerColor;
  distance: number;
  alive: boolean;
}

export interface GameLoopCallbacks {
  onPlayerDied?: (roomId: string, playerId: string, color: PlayerColor) => void;
  onGameEnded?: (roomId: string, scores: PlayerScore[]) => void;
  onStateUpdate?: (roomId: string, room: GameRoom) => void;
}

interface RunningRoom {
  room: GameRoom;
  generator: ObstacleGenerator;
  pickups: PowerUpGenerator;
  hitObstacles: Map<string, Set<string>>;
  warnedObstacles: Map<string, Set<string>>;
  lastWarningAt: Map<string, number>;
  timer: NodeJS.Timeout;
  lastTime: number;
  accumulated: number;
  broadcastElapsed: number;
}

const STEP = 1 / GAME_CONFIG.TICK_RATE;

/** A round owns its generators, clock and damage history. */
export class GameLoop {
  private rooms = new Map<string, RunningRoom>();
  private collisionDetector = new CollisionDetector();

  constructor(
    private callbacks: GameLoopCallbacks = {},
    private clock: () => number = () => performance.now()
  ) {}

  start(room: GameRoom): void {
    this.stop(room.id);
    if (room.players.length < GAME_CONFIG.MIN_PLAYERS) return;
    const generator = new ObstacleGenerator();
    generator.init(room.seed, room.players.map(player => player.color));
    room.gameState = GameState.PLAYING;
    room.worldPosition = 0;
    room.elapsed = 0;
    room.endReason = undefined;
    room.obstacles = generator.generateNext(0);
    const pickups = new PowerUpGenerator(room.seed);
    room.powerUps = pickups.generate(0);
    for (const player of room.players) {
      Object.assign(player, { alive: true, distance: 0, lives: GAME_CONFIG.MAX_LIVES,
        shield: false, invulnerableUntil: 0, survivalTime: 0, totalMoves: 0, warningsSent: 0, lastDamage: undefined });
    }
    this.rooms.set(room.id, {
      room, generator, pickups,
      hitObstacles: new Map(room.players.map(player => [player.id, new Set<string>()])),
      warnedObstacles: new Map(room.players.map(player => [player.id, new Set<string>()])),
      lastWarningAt: new Map(),
      lastTime: this.clock(), accumulated: 0, broadcastElapsed: 0,
      timer: setInterval(() => this.tick(room.id), 1000 * STEP)
    });
  }

  stop(roomId: string): void {
    const running = this.rooms.get(roomId);
    if (running) clearInterval(running.timer);
    this.rooms.delete(roomId);
  }

  tick(roomId: string): void {
    const running = this.rooms.get(roomId);
    if (!running) return;
    const now = this.clock();
    // Bound catch-up after suspension, always checking collisions in small steps.
    running.accumulated += Math.max(0, Math.min((now - running.lastTime) / 1000, 0.25));
    running.lastTime = now;
    while (running.accumulated + 1e-9 >= STEP && this.rooms.has(roomId)) {
      running.accumulated -= STEP;
      this.step(running);
    }
  }

  private step(running: RunningRoom): void {
    const { room, generator, pickups, hitObstacles } = running;
    const speed = phaseAtTime((room.elapsed ?? 0) + 1e-9).speed;
    room.elapsed = Math.min(ROUND_DURATION, (room.elapsed ?? 0) + STEP);
    room.worldPosition += speed * STEP;
    room.obstacles.push(...generator.generateNext(room.worldPosition));
    room.obstacles = room.obstacles.filter(obstacle => obstacle.y > room.worldPosition - 2);
    room.powerUps = [...(room.powerUps ?? []), ...pickups.generate(room.worldPosition)]
      .filter(pickup => pickup.worldY > room.worldPosition - 2);
    const activeIds = new Set(room.obstacles.map(obstacle => obstacle.id));

    for (const warned of running.warnedObstacles.values()) {
      for (const id of warned) if (!activeIds.has(id)) warned.delete(id);
    }
    for (const player of room.players) {
      if (!player.alive) continue;
      player.distance = room.worldPosition;
      player.survivalTime = room.elapsed;
      const hits = hitObstacles.get(player.id)!;
      for (const id of hits) if (!activeIds.has(id)) hits.delete(id);
      for (const pickup of room.powerUps) {
        if (pickup.route !== player.route || Math.abs(pickup.worldY - player.distance) > 0.5 || pickup.collectedBy.has(player.id)) continue;
        if (pickup.kind === 'heart') player.lives = Math.min(GAME_CONFIG.MAX_LIVES, (player.lives ?? GAME_CONFIG.MAX_LIVES) + 1);
        else player.shield = true;
        pickup.collectedBy.add(player.id);
      }
      const obstacle = this.collisionDetector.checkCollision(player, room.obstacles);
      if (!obstacle || hits.has(obstacle.id)) continue;
      hits.add(obstacle.id);
      if ((player.invulnerableUntil ?? 0) > room.elapsed) continue;
      if (player.shield) player.shield = false;
      else {
        player.lives = Math.max(0, (player.lives ?? GAME_CONFIG.MAX_LIVES) - 1);
        player.lastDamage = { route: player.route, distance: player.distance };
      }
      player.invulnerableUntil = room.elapsed + GAME_CONFIG.HIT_INVULNERABILITY;
      if (player.lives === 0) {
        player.alive = false;
        this.callbacks.onPlayerDied?.(room.id, player.id, player.color);
      }
    }
    if (room.players.filter(player => player.alive).length <= 1) {
      this.endGame(room);
      return;
    }
    if (room.elapsed + 1e-9 >= ROUND_DURATION) {
      this.endGame(room, 'time_limit');
      return;
    }
    running.broadcastElapsed += STEP;
    if (running.broadcastElapsed + 1e-9 >= 1 / GAME_CONFIG.STATE_BROADCAST_RATE) {
      running.broadcastElapsed = 0;
      this.callbacks.onStateUpdate?.(room.id, room);
    }
  }

  warnObstacle(roomId: string, playerId: string, obstacleId: string): TeamWarning | null {
    const running = this.rooms.get(roomId);
    if (!running) return null;
    const { room } = running;
    const sender = room.players.find(player => player.id === playerId);
    const obstacle = room.obstacles.find(candidate => candidate.id === obstacleId);
    if (!sender?.alive || !obstacle || sender.color === obstacle.color) return null;
    const ahead = obstacle.y - sender.distance;
    if (ahead < 0.5 || ahead > GAME_CONFIG.GRID_ROWS) return null;
    const target = room.players.find(player => player.color === obstacle.color && player.alive);
    const elapsed = room.elapsed ?? 0;
    const warned = running.warnedObstacles.get(playerId)!;
    if (!target || warned.has(obstacleId) || elapsed - (running.lastWarningAt.get(playerId) ?? -Infinity) < 1) return null;
    warned.add(obstacleId);
    running.lastWarningAt.set(playerId, elapsed);
    sender.warningsSent = (sender.warningsSent ?? 0) + 1;
    return { fromPlayerId: sender.id, toPlayerId: target.id, fromColor: sender.color,
      toColor: target.color, route: obstacle.route, durationMs: 1500 };
  }

  disconnectPlayer(roomId: string, playerId: string): void {
    const room = this.getRoom(roomId);
    const player = room?.players.find(candidate => candidate.id === playerId);
    if (!room || !player || !player.alive) return;
    player.alive = false;
    player.lives = 0;
    if (room.players.filter(candidate => candidate.alive).length <= 1) this.endGame(room);
  }

  private endGame(room: GameRoom, reason: 'last_survivor' | 'time_limit' = 'last_survivor'): void {
    room.endReason = reason;
    room.gameState = GameState.ENDED;
    this.callbacks.onGameEnded?.(room.id, room.players.map(player => ({
      id: player.id, color: player.color, distance: player.distance, alive: player.alive
    })));
    this.stop(room.id);
  }

  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId)?.room ?? null;
  }

  handlePlayerInput(roomId: string, playerId: string, newRoute: RouteIndex): void {
    const player = this.getRoom(roomId)?.players.find(candidate => candidate.id === playerId);
    if (!player?.alive || !Number.isInteger(newRoute) || newRoute < 0 || newRoute >= GAME_CONFIG.GRID_COLS) return;
    if (player.route !== newRoute) player.totalMoves = (player.totalMoves ?? 0) + 1;
    player.route = newRoute;
  }

  isRunning(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  static getConfig() {
    return { TICK_RATE: GAME_CONFIG.TICK_RATE, WORLD_SPEED: GAME_CONFIG.WORLD_SPEED,
      BROADCAST_RATE: GAME_CONFIG.STATE_BROADCAST_RATE };
  }
}
