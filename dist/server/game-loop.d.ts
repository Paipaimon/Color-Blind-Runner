import { TeamWarning } from '../shared/messages.js';
import { PlayerColor } from '../shared/types.js';
import { Obstacle } from './obstacle-generator.js';
import { Player } from './collision-detector.js';
import { RouteIndex } from './player-logic.js';
import { PowerUp } from './power-ups.js';
export declare enum GameState {
    WAITING = "waiting",
    PLAYING = "playing",
    ENDED = "ended"
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
/** A round owns its generators, clock and damage history. */
export declare class GameLoop {
    private callbacks;
    private clock;
    private rooms;
    private collisionDetector;
    constructor(callbacks?: GameLoopCallbacks, clock?: () => number);
    start(room: GameRoom): void;
    stop(roomId: string): void;
    tick(roomId: string): void;
    private step;
    warnObstacle(roomId: string, playerId: string, obstacleId: string): TeamWarning | null;
    disconnectPlayer(roomId: string, playerId: string): void;
    private endGame;
    getRoom(roomId: string): GameRoom | null;
    handlePlayerInput(roomId: string, playerId: string, newRoute: RouteIndex): void;
    isRunning(roomId: string): boolean;
    static getConfig(): {
        TICK_RATE: 60;
        WORLD_SPEED: 3;
        BROADCAST_RATE: 20;
    };
}
//# sourceMappingURL=game-loop.d.ts.map