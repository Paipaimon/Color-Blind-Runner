/**
 * 集成测试
 * 测试完整游戏流程：创建房间 → 加入 → 准备 → 游戏 → 死亡 → 结束
 *
 * Requirements: 全流程验证
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager } from './room-manager.js';
import { GameLoop, GameState as GameLoopState } from './game-loop.js';
import { VisibilityFilter, GameState as VisibilityGameState } from './visibility-filter.js';
import { applyInput } from './player-logic.js';
import { PlayerColor, GameState } from '../shared/types.js';
describe('Integration Tests - 完整游戏流程', () => {
    let roomManager;
    let gameLoop;
    let visibilityFilter;
    // 回调追踪
    let playerDiedEvents = [];
    let gameEndedEvents = [];
    let stateUpdateEvents = [];
    beforeEach(() => {
        // 重置事件追踪
        playerDiedEvents = [];
        gameEndedEvents = [];
        stateUpdateEvents = [];
        // 初始化组件
        roomManager = new RoomManager();
        visibilityFilter = new VisibilityFilter();
        // 初始化游戏循环，设置回调
        gameLoop = new GameLoop({
            onPlayerDied: (roomId, playerId, color) => {
                playerDiedEvents.push({ roomId, playerId, color });
            },
            onGameEnded: (roomId, scores) => {
                gameEndedEvents.push({ roomId, scores });
            },
            onStateUpdate: (roomId, room) => {
                stateUpdateEvents.push({ roomId, room: { ...room } });
            }
        });
        // 使用 fake timers 控制时间
        vi.useFakeTimers();
    });
    afterEach(() => {
        // 清理所有游戏循环
        const rooms = roomManager.getAllRooms();
        for (const room of rooms) {
            gameLoop.stop(room.id);
        }
        vi.useRealTimers();
    });
    describe('房间管理流程', () => {
        it('应该能创建房间并获得唯一ID', () => {
            // Requirements: 1.1
            const roomId1 = roomManager.createRoom();
            const roomId2 = roomManager.createRoom();
            expect(roomId1).toBeTruthy();
            expect(roomId2).toBeTruthy();
            expect(roomId1).not.toBe(roomId2);
        });
        it('应该能加入房间并分配颜色', () => {
            // Requirements: 1.1, 1.2
            const roomId = roomManager.createRoom();
            const player1 = roomManager.joinRoom(roomId);
            const player2 = roomManager.joinRoom(roomId);
            expect(player1).not.toBeNull();
            expect(player2).not.toBeNull();
            expect(player1.color).toBe(PlayerColor.RED);
            expect(player2.color).toBe(PlayerColor.GREEN);
        });
        it('房间满员后应该拒绝新玩家', () => {
            // Requirements: 1.3
            const roomId = roomManager.createRoom();
            // 加入最大玩家数
            roomManager.joinRoom(roomId);
            roomManager.joinRoom(roomId);
            roomManager.joinRoom(roomId);
            // 第4个玩家应该被拒绝
            const player4 = roomManager.joinRoom(roomId);
            expect(player4).toBeNull();
        });
        it('所有玩家准备后应该能开始游戏', () => {
            // Requirements: 1.4
            const roomId = roomManager.createRoom();
            const player1 = roomManager.joinRoom(roomId);
            const player2 = roomManager.joinRoom(roomId);
            expect(player1).not.toBeNull();
            expect(player2).not.toBeNull();
            // 设置准备状态
            roomManager.setPlayerReady(roomId, player1.id, true);
            roomManager.setPlayerReady(roomId, player2.id, true);
            expect(roomManager.areAllPlayersReady(roomId)).toBe(true);
            // 开始游戏
            const started = roomManager.startGame(roomId);
            expect(started).toBe(true);
            const room = roomManager.getRoom(roomId);
            expect(room?.gameState).toBe(GameState.COUNTDOWN);
        });
    });
    describe('玩家输入与路线切换', () => {
        it('应该正确处理左移输入', () => {
            // Requirements: 2.1, 2.3
            expect(applyInput(1, { type: 'move_left' })).toBe(0);
            expect(applyInput(0, { type: 'move_left' })).toBe(0); // 边界
        });
        it('应该正确处理右移输入', () => {
            // Requirements: 2.2, 2.4
            expect(applyInput(1, { type: 'move_right' })).toBe(2);
            expect(applyInput(2, { type: 'move_right' })).toBe(2); // 边界
        });
    });
    describe('游戏循环与状态更新', () => {
        it('应该启动游戏循环并更新世界位置', () => {
            // Requirements: 3.1, 3.2
            const gameRoom = createTestGameRoom();
            gameLoop.start(gameRoom);
            // 推进时间 100ms
            vi.advanceTimersByTime(100);
            const room = gameLoop.getRoom(gameRoom.id);
            expect(room).not.toBeNull();
            expect(room.worldPosition).toBeGreaterThan(0);
            expect(room.gameState).toBe(GameLoopState.PLAYING);
        });
        it('应该更新存活玩家的距离', () => {
            // Requirements: 9.1
            const gameRoom = createTestGameRoom();
            gameLoop.start(gameRoom);
            // 推进时间
            vi.advanceTimersByTime(100);
            const room = gameLoop.getRoom(gameRoom.id);
            expect(room).not.toBeNull();
            // 存活玩家距离应该增加
            const alivePlayer = room.players.find(p => p.alive);
            expect(alivePlayer).not.toBeUndefined();
            expect(alivePlayer.distance).toBeGreaterThan(0);
        });
    });
    describe('可见性过滤', () => {
        it('应该过滤掉玩家自己颜色的障碍物', () => {
            // Requirements: 5.1, 5.2
            const player = {
                id: 'player1',
                color: PlayerColor.RED,
                route: 1,
                alive: true,
                distance: 100,
                ready: true
            };
            const obstacles = [
                { id: 'o1', color: PlayerColor.RED, route: 1, y: 150 },
                { id: 'o2', color: PlayerColor.BLUE, route: 1, y: 200 },
                { id: 'o3', color: PlayerColor.GREEN, route: 0, y: 250 }
            ];
            const worldState = {
                players: [player],
                obstacles,
                worldPosition: 0,
                gameState: VisibilityGameState.PLAYING
            };
            const visibleState = visibilityFilter.filterForPlayer(worldState, player);
            // 应该只看到非红色障碍物
            expect(visibleState.visibleObstacles).toHaveLength(2);
            expect(visibleState.visibleObstacles.every(o => o.color !== PlayerColor.RED)).toBe(true);
        });
        it('应该生成近距离提示', () => {
            // Requirements: 5.3
            const player = {
                id: 'player1',
                color: PlayerColor.RED,
                route: 1,
                alive: true,
                distance: 100,
                ready: true
            };
            // 在玩家附近放置同色障碍物
            const obstacles = [
                { id: 'o1', color: PlayerColor.RED, route: 1, y: 150 } // 距离50，在提示范围内
            ];
            const worldState = {
                players: [player],
                obstacles,
                worldPosition: 0,
                gameState: VisibilityGameState.PLAYING
            };
            const visibleState = visibilityFilter.filterForPlayer(worldState, player);
            // 应该有近距离提示
            expect(visibleState.proximityHints.length).toBeGreaterThan(0);
            expect(visibleState.proximityHints[0].route).toBe(1);
        });
        it('不应该暴露其他玩家的位置信息', () => {
            // Requirements: 7.1
            const player1 = {
                id: 'player1',
                color: PlayerColor.RED,
                route: 1,
                alive: true,
                distance: 100,
                ready: true
            };
            const player2 = {
                id: 'player2',
                color: PlayerColor.BLUE,
                route: 2,
                alive: true,
                distance: 150,
                ready: true
            };
            const worldState = {
                players: [player1, player2],
                obstacles: [],
                worldPosition: 0,
                gameState: VisibilityGameState.PLAYING
            };
            const visibleState = visibilityFilter.filterForPlayer(worldState, player1);
            // myPlayer 应该只是 player1
            expect(visibleState.myPlayer.id).toBe('player1');
            // scores 不应该包含路线信息
            expect(visibleState.scores).toHaveLength(2);
            for (const score of visibleState.scores) {
                expect(score).not.toHaveProperty('route');
            }
        });
    });
    describe('碰撞与死亡流程', () => {
        it('玩家碰撞同色障碍物后应该死亡', async () => {
            // Requirements: 6.1, 6.2, 6.3
            const gameRoom = {
                id: 'test-room',
                players: [
                    {
                        id: 'player1',
                        color: PlayerColor.RED,
                        route: 1,
                        alive: true,
                        distance: 0,
                        ready: true
                    }
                ],
                obstacles: [
                    // 放置一个同色障碍物在玩家前方
                    {
                        id: 'obstacle1',
                        color: PlayerColor.RED,
                        route: 1,
                        y: 10 // 很近的位置
                    }
                ],
                worldPosition: 0,
                gameState: GameLoopState.PLAYING,
                seed: 12345
            };
            gameLoop.start(gameRoom);
            // 推进时间让玩家移动到障碍物位置
            vi.advanceTimersByTime(200);
            // 检查死亡事件
            expect(playerDiedEvents.length).toBeGreaterThanOrEqual(1);
            expect(playerDiedEvents[0].playerId).toBe('player1');
            expect(playerDiedEvents[0].color).toBe(PlayerColor.RED);
        });
        it('死亡玩家的状态不应该再改变', () => {
            // Requirements: 6.2, 9.2
            const gameRoom = {
                id: 'test-room',
                players: [
                    {
                        id: 'player1',
                        color: PlayerColor.RED,
                        route: 1,
                        alive: false, // 已死亡
                        distance: 100,
                        ready: true
                    },
                    {
                        id: 'player2',
                        color: PlayerColor.BLUE,
                        route: 1,
                        alive: true,
                        distance: 0,
                        ready: true
                    }
                ],
                obstacles: [],
                worldPosition: 0,
                gameState: GameLoopState.PLAYING,
                seed: 12345
            };
            const initialDistance = gameRoom.players[0].distance;
            const initialRoute = gameRoom.players[0].route;
            gameLoop.start(gameRoom);
            // 推进时间
            vi.advanceTimersByTime(100);
            const room = gameLoop.getRoom(gameRoom.id);
            const deadPlayer = room.players.find(p => p.id === 'player1');
            // 死亡玩家的距离和路线不应该改变
            expect(deadPlayer.distance).toBe(initialDistance);
            expect(deadPlayer.route).toBe(initialRoute);
        });
        it('死亡玩家不应该响应输入', () => {
            // Requirements: 6.2
            const gameRoom = {
                id: 'test-room',
                players: [
                    {
                        id: 'player1',
                        color: PlayerColor.RED,
                        route: 1,
                        alive: false, // 已死亡
                        distance: 100,
                        ready: true
                    }
                ],
                obstacles: [],
                worldPosition: 0,
                gameState: GameLoopState.PLAYING,
                seed: 12345
            };
            gameLoop.start(gameRoom);
            // 尝试移动死亡玩家
            gameLoop.handlePlayerInput('test-room', 'player1', 0);
            const room = gameLoop.getRoom(gameRoom.id);
            const player = room.players.find(p => p.id === 'player1');
            // 路线应该保持不变
            expect(player.route).toBe(1);
        });
    });
    describe('游戏结束流程', () => {
        it('所有玩家死亡后游戏应该结束', () => {
            // Requirements: 6.4
            const gameRoom = {
                id: 'test-room',
                players: [
                    {
                        id: 'player1',
                        color: PlayerColor.RED,
                        route: 1,
                        alive: true,
                        distance: 0,
                        ready: true
                    }
                ],
                obstacles: [
                    // 放置障碍物确保玩家死亡
                    {
                        id: 'obstacle1',
                        color: PlayerColor.RED,
                        route: 1,
                        y: 5
                    }
                ],
                worldPosition: 0,
                gameState: GameLoopState.PLAYING,
                seed: 12345
            };
            gameLoop.start(gameRoom);
            // 推进时间让玩家碰撞死亡
            vi.advanceTimersByTime(500);
            // 检查游戏结束事件
            expect(gameEndedEvents.length).toBe(1);
            expect(gameEndedEvents[0].roomId).toBe('test-room');
            expect(gameEndedEvents[0].scores).toHaveLength(1);
        });
        it('游戏结束时应该报告最终分数', () => {
            // Requirements: 9.3
            const gameRoom = {
                id: 'test-room',
                players: [
                    {
                        id: 'player1',
                        color: PlayerColor.RED,
                        route: 1,
                        alive: true,
                        distance: 50,
                        ready: true
                    },
                    {
                        id: 'player2',
                        color: PlayerColor.BLUE,
                        route: 0,
                        alive: true,
                        distance: 30,
                        ready: true
                    }
                ],
                obstacles: [
                    // 两个障碍物让两个玩家都死亡
                    { id: 'o1', color: PlayerColor.RED, route: 1, y: 55 },
                    { id: 'o2', color: PlayerColor.BLUE, route: 0, y: 35 }
                ],
                worldPosition: 0,
                gameState: GameLoopState.PLAYING,
                seed: 12345
            };
            gameLoop.start(gameRoom);
            // 推进时间
            vi.advanceTimersByTime(500);
            // 检查分数
            expect(gameEndedEvents.length).toBe(1);
            const scores = gameEndedEvents[0].scores;
            expect(scores).toHaveLength(2);
            // 每个玩家都应该有分数记录
            const redScore = scores.find(s => s.color === PlayerColor.RED);
            const blueScore = scores.find(s => s.color === PlayerColor.BLUE);
            expect(redScore).toBeDefined();
            expect(blueScore).toBeDefined();
            expect(redScore.alive).toBe(false);
            expect(blueScore.alive).toBe(false);
        });
    });
    describe('完整游戏流程端到端测试', () => {
        it('应该完成完整的游戏流程：创建 → 加入 → 准备 → 游戏 → 死亡 → 结束', () => {
            // 1. 创建房间
            const roomId = roomManager.createRoom();
            expect(roomId).toBeTruthy();
            // 2. 玩家加入
            const player1 = roomManager.joinRoom(roomId);
            const player2 = roomManager.joinRoom(roomId);
            expect(player1).not.toBeNull();
            expect(player2).not.toBeNull();
            expect(player1.color).toBe(PlayerColor.RED);
            expect(player2.color).toBe(PlayerColor.GREEN);
            // 3. 玩家准备
            roomManager.setPlayerReady(roomId, player1.id, true);
            roomManager.setPlayerReady(roomId, player2.id, true);
            expect(roomManager.areAllPlayersReady(roomId)).toBe(true);
            // 4. 开始游戏
            const started = roomManager.startGame(roomId);
            expect(started).toBe(true);
            // 5. 创建游戏房间并启动游戏循环
            const gameRoom = {
                id: roomId,
                players: [
                    {
                        id: player1.id,
                        color: player1.color,
                        route: 1,
                        alive: true,
                        distance: 0,
                        ready: true
                    },
                    {
                        id: player2.id,
                        color: player2.color,
                        route: 1,
                        alive: true,
                        distance: 0,
                        ready: true
                    }
                ],
                obstacles: [
                    // 放置障碍物让玩家死亡
                    { id: 'o1', color: PlayerColor.RED, route: 1, y: 10 },
                    { id: 'o2', color: PlayerColor.GREEN, route: 1, y: 15 }
                ],
                worldPosition: 0,
                gameState: GameLoopState.PLAYING,
                seed: Date.now()
            };
            gameLoop.start(gameRoom);
            // 6. 推进时间，玩家应该碰撞死亡
            vi.advanceTimersByTime(500);
            // 7. 验证死亡事件
            expect(playerDiedEvents.length).toBeGreaterThanOrEqual(2);
            // 8. 验证游戏结束
            expect(gameEndedEvents.length).toBe(1);
            expect(gameEndedEvents[0].scores).toHaveLength(2);
            // 9. 验证最终状态
            const room = gameLoop.getRoom(roomId);
            expect(room?.gameState).toBe(GameLoopState.ENDED);
        });
    });
    describe('断开连接处理', () => {
        it('游戏中断开连接应该标记玩家死亡', () => {
            // Requirements: 1.5
            const roomId = roomManager.createRoom();
            const player1 = roomManager.joinRoom(roomId);
            const player2 = roomManager.joinRoom(roomId);
            // 设置准备并开始游戏
            roomManager.setPlayerReady(roomId, player1.id, true);
            roomManager.setPlayerReady(roomId, player2.id, true);
            roomManager.startGame(roomId);
            // 更新房间状态为 PLAYING
            const room = roomManager.getRoom(roomId);
            room.gameState = GameState.PLAYING;
            // 玩家1断开连接
            roomManager.leaveRoom(roomId, player1.id);
            // 验证玩家1被标记为死亡
            const updatedRoom = roomManager.getRoom(roomId);
            const deadPlayer = updatedRoom?.players.get(player1.id);
            expect(deadPlayer?.isAlive).toBe(false);
        });
    });
});
/**
 * 创建测试用游戏房间
 */
function createTestGameRoom() {
    return {
        id: 'test-room-' + Date.now(),
        players: [
            {
                id: 'player1',
                color: PlayerColor.RED,
                route: 1,
                alive: true,
                distance: 0,
                ready: true
            },
            {
                id: 'player2',
                color: PlayerColor.BLUE,
                route: 1,
                alive: true,
                distance: 0,
                ready: true
            }
        ],
        obstacles: [],
        worldPosition: 0,
        gameState: GameLoopState.PLAYING,
        seed: 12345
    };
}
//# sourceMappingURL=integration.test.js.map