import { Room, Player } from '../shared/types.js';
export declare class RoomManager {
    private rooms;
    private readyStates;
    private playerRoomMap;
    /**
     * 创建新房间
     * @returns 房间ID
     * Requirements: 1.1
     */
    createRoom(): string;
    /**
     * 加入房间
     * @param roomId 房间ID
     * @param playerId 可选的玩家ID，不提供则自动生成
     * @returns 分配的玩家信息，如果房间已满或不存在则返回 null
     * Requirements: 1.1, 1.2, 1.3
     */
    joinRoom(roomId: string, playerId?: string): Player | null;
    /**
     * 离开房间
     * @param roomId 房间ID
     * @param playerId 玩家ID
     * Requirements: 1.5 (断开连接处理)
     */
    leaveRoom(roomId: string, playerId: string): void;
    /**
     * 获取房间
     * @param roomId 房间ID
     * @returns 房间信息，不存在则返回 null
     */
    getRoom(roomId: string): Room | null;
    /**
     * 根据玩家ID获取其所在房间
     * @param playerId 玩家ID
     * @returns 房间信息，不存在则返回 null
     */
    getRoomByPlayerId(playerId: string): Room | null;
    /**
     * 设置玩家准备状态
     * @param roomId 房间ID
     * @param playerId 玩家ID
     * @param ready 是否准备好
     * Requirements: 1.4
     */
    setPlayerReady(roomId: string, playerId: string, ready: boolean): void;
    /**
     * 获取玩家准备状态
     * @param roomId 房间ID
     * @param playerId 玩家ID
     * @returns 是否准备好
     */
    isPlayerReady(roomId: string, playerId: string): boolean;
    /**
     * 检查是否所有玩家都准备好
     * @param roomId 房间ID
     * @returns 是否所有玩家都准备好
     * Requirements: 1.4
     */
    areAllPlayersReady(roomId: string): boolean;
    /**
     * 开始游戏
     * @param roomId 房间ID
     * @returns 是否成功开始
     * Requirements: 1.4
     */
    startGame(roomId: string): boolean;
    /**
     * 标记玩家死亡
     * @param roomId 房间ID
     * @param playerId 玩家ID
     * Requirements: 1.5
     */
    markPlayerDead(roomId: string, playerId: string): void;
    /**
     * 检查游戏是否应该结束（所有玩家都死亡）
     * @param roomId 房间ID
     * @returns 是否所有玩家都死亡
     */
    areAllPlayersDead(roomId: string): boolean;
    /**
     * 结束游戏
     * @param roomId 房间ID
     */
    endGame(roomId: string): void;
    /**
     * 获取所有房间（用于调试或管理）
     * @returns 所有房间的数组
     */
    getAllRooms(): Room[];
    /**
     * 查找可加入的房间（用于自动匹配）
     * @returns 可加入的房间ID，如果没有则返回 null
     */
    findAvailableRoom(): string | null;
    /**
     * 加入或创建房间（自动匹配）
     * @param playerId 可选的玩家ID
     * @returns { roomId, player } 或 null
     */
    joinOrCreateRoom(playerId?: string): {
        roomId: string;
        player: Player;
    } | null;
    /**
     * 获取房间中的玩家列表
     * @param roomId 房间ID
     * @returns 玩家数组
     */
    getPlayersInRoom(roomId: string): Player[];
    /**
     * 获取房间中存活的玩家列表
     * @param roomId 房间ID
     * @returns 存活玩家数组
     */
    getAlivePlayersInRoom(roomId: string): Player[];
}
//# sourceMappingURL=room-manager.d.ts.map