import { Room, Player, PlayerColor, GameState, Position } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';

/**
 * 房间管理器
 * 负责创建房间、加入房间、离开房间、颜色分配等
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

/**
 * 颜色分配顺序
 * 玩家按加入顺序依次分配颜色
 * 第1名: RED, 第2名: BLUE, 第3名: YELLOW, 第4名: GREEN
 */
const COLOR_SEQUENCE: PlayerColor[] = [
  PlayerColor.RED,
  PlayerColor.BLUE,
  PlayerColor.YELLOW,
  PlayerColor.GREEN
];

/**
 * 玩家准备状态追踪
 * 由于 Player 类型没有 ready 字段，单独管理
 */
interface PlayerReadyState {
  playerId: string;
  ready: boolean;
}

/**
 * 生成唯一房间ID
 * 使用时间戳 + 随机数确保唯一性
 */
function generateRoomId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * 生成唯一玩家ID
 */
function generatePlayerId(): string {
  return `player-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 获取玩家初始位置
 * 根据颜色分配不同的起始X坐标
 */
function getInitialPosition(color: PlayerColor): Position {
  const colorIndex = COLOR_SEQUENCE.indexOf(color);
  const spacing = GAME_CONFIG.GAME_WIDTH / (GAME_CONFIG.MAX_PLAYERS + 1);
  return {
    x: spacing * (colorIndex + 1),
    y: GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.PLAYER_SIZE * 2
  };
}

export class RoomManager {
  // 所有房间的存储
  private rooms: Map<string, Room> = new Map();
  
  // 玩家准备状态（roomId -> playerId -> ready）
  private readyStates: Map<string, Map<string, boolean>> = new Map();
  
  // 玩家到房间的映射（用于快速查找玩家所在房间）
  private playerRoomMap: Map<string, string> = new Map();

  /**
   * 创建新房间
   * @returns 房间ID
   * Requirements: 1.1
   */
  createRoom(): string {
    const roomId = generateRoomId();
    
    const room: Room = {
      id: roomId,
      players: new Map(),
      obstacles: [],
      scrollSpeed: GAME_CONFIG.INITIAL_SCROLL_SPEED,
      gameState: GameState.WAITING,
      startTime: null
    };
    
    this.rooms.set(roomId, room);
    this.readyStates.set(roomId, new Map());
    
    return roomId;
  }


  /**
   * 加入房间
   * @param roomId 房间ID
   * @param playerId 可选的玩家ID，不提供则自动生成
   * @returns 分配的玩家信息，如果房间已满或不存在则返回 null
   * Requirements: 1.1, 1.2, 1.3
   */
  joinRoom(roomId: string, playerId?: string): Player | null {
    const room = this.rooms.get(roomId);
    
    // 房间不存在
    if (!room) {
      return null;
    }
    
    // 房间已满（最多 MAX_PLAYERS 个玩家）
    if (room.players.size >= GAME_CONFIG.MAX_PLAYERS) {
      return null;
    }
    
    // 游戏已开始，不允许加入
    if (room.gameState !== GameState.WAITING) {
      return null;
    }
    
    // 生成或使用提供的玩家ID
    const finalPlayerId = playerId || generatePlayerId();
    
    // 分配颜色：按顺序分配第一个未使用的颜色
    const usedColors = new Set(
      Array.from(room.players.values()).map(p => p.color)
    );
    const assignedColor = COLOR_SEQUENCE.find(c => !usedColors.has(c));
    
    if (!assignedColor) {
      // 所有颜色都已分配（理论上不会发生，因为颜色数 >= MAX_PLAYERS）
      return null;
    }
    
    // 创建玩家
    const player: Player = {
      id: finalPlayerId,
      color: assignedColor,
      position: getInitialPosition(assignedColor),
      isAlive: true
    };
    
    // 添加到房间
    room.players.set(finalPlayerId, player);
    
    // 初始化准备状态为 false
    const roomReadyStates = this.readyStates.get(roomId);
    if (roomReadyStates) {
      roomReadyStates.set(finalPlayerId, false);
    }
    
    // 记录玩家所在房间
    this.playerRoomMap.set(finalPlayerId, roomId);
    
    return player;
  }

  /**
   * 离开房间
   * @param roomId 房间ID
   * @param playerId 玩家ID
   * Requirements: 1.5 (断开连接处理)
   */
  leaveRoom(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    
    // 如果游戏正在进行，标记玩家为死亡而不是移除
    if (room.gameState === GameState.PLAYING) {
      const player = room.players.get(playerId);
      if (player) {
        player.isAlive = false;
      }
    } else {
      // 游戏未开始，直接移除玩家
      room.players.delete(playerId);
    }
    
    // 清理准备状态
    const roomReadyStates = this.readyStates.get(roomId);
    if (roomReadyStates) {
      roomReadyStates.delete(playerId);
    }
    
    // 清理玩家房间映射
    this.playerRoomMap.delete(playerId);
    
    // 如果房间为空且游戏未开始，删除房间
    if (room.players.size === 0 && room.gameState === GameState.WAITING) {
      this.rooms.delete(roomId);
      this.readyStates.delete(roomId);
    }
  }

  /**
   * 获取房间
   * @param roomId 房间ID
   * @returns 房间信息，不存在则返回 null
   */
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * 根据玩家ID获取其所在房间
   * @param playerId 玩家ID
   * @returns 房间信息，不存在则返回 null
   */
  getRoomByPlayerId(playerId: string): Room | null {
    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) {
      return null;
    }
    return this.getRoom(roomId);
  }

  /**
   * 设置玩家准备状态
   * @param roomId 房间ID
   * @param playerId 玩家ID
   * @param ready 是否准备好
   * Requirements: 1.4
   */
  setPlayerReady(roomId: string, playerId: string, ready: boolean): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    
    // 只有在等待状态才能设置准备
    if (room.gameState !== GameState.WAITING) {
      return;
    }
    
    // 玩家必须在房间中
    if (!room.players.has(playerId)) {
      return;
    }
    
    const roomReadyStates = this.readyStates.get(roomId);
    if (roomReadyStates) {
      roomReadyStates.set(playerId, ready);
    }
  }

  /**
   * 获取玩家准备状态
   * @param roomId 房间ID
   * @param playerId 玩家ID
   * @returns 是否准备好
   */
  isPlayerReady(roomId: string, playerId: string): boolean {
    const roomReadyStates = this.readyStates.get(roomId);
    if (!roomReadyStates) {
      return false;
    }
    return roomReadyStates.get(playerId) || false;
  }

  /**
   * 检查是否所有玩家都准备好
   * @param roomId 房间ID
   * @returns 是否所有玩家都准备好
   * Requirements: 1.4
   */
  areAllPlayersReady(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    
    // 至少需要 MIN_PLAYERS 个玩家
    if (room.players.size < GAME_CONFIG.MIN_PLAYERS) {
      return false;
    }
    
    const roomReadyStates = this.readyStates.get(roomId);
    if (!roomReadyStates) {
      return false;
    }
    
    // 检查所有玩家是否都准备好
    for (const playerId of room.players.keys()) {
      if (!roomReadyStates.get(playerId)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 开始游戏
   * @param roomId 房间ID
   * @returns 是否成功开始
   * Requirements: 1.4
   */
  startGame(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    
    // 只有在等待状态且所有玩家准备好才能开始
    if (room.gameState !== GameState.WAITING) {
      return false;
    }
    
    if (!this.areAllPlayersReady(roomId)) {
      return false;
    }
    
    // 更新游戏状态
    room.gameState = GameState.COUNTDOWN;
    room.startTime = Date.now();
    
    return true;
  }

  /**
   * 标记玩家死亡
   * @param roomId 房间ID
   * @param playerId 玩家ID
   * Requirements: 1.5
   */
  markPlayerDead(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    
    const player = room.players.get(playerId);
    if (player) {
      player.isAlive = false;
    }
  }

  /**
   * 检查游戏是否应该结束（所有玩家都死亡）
   * @param roomId 房间ID
   * @returns 是否所有玩家都死亡
   */
  areAllPlayersDead(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    
    for (const player of room.players.values()) {
      if (player.isAlive) {
        return false;
      }
    }
    
    return room.players.size > 0;
  }

  /**
   * 结束游戏
   * @param roomId 房间ID
   */
  endGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.gameState = GameState.GAME_OVER;
    }
  }

  /**
   * 获取所有房间（用于调试或管理）
   * @returns 所有房间的数组
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * 查找可加入的房间（用于自动匹配）
   * @returns 可加入的房间ID，如果没有则返回 null
   */
  findAvailableRoom(): string | null {
    for (const [roomId, room] of this.rooms) {
      if (
        room.gameState === GameState.WAITING &&
        room.players.size < GAME_CONFIG.MAX_PLAYERS
      ) {
        return roomId;
      }
    }
    return null;
  }

  /**
   * 加入或创建房间（自动匹配）
   * @param playerId 可选的玩家ID
   * @returns { roomId, player } 或 null
   */
  joinOrCreateRoom(playerId?: string): { roomId: string; player: Player } | null {
    // 先尝试找到可加入的房间
    let roomId = this.findAvailableRoom();
    
    // 如果没有可用房间，创建新房间
    if (!roomId) {
      roomId = this.createRoom();
    }
    
    // 加入房间
    const player = this.joinRoom(roomId, playerId);
    if (!player) {
      return null;
    }
    
    return { roomId, player };
  }

  /**
   * 获取房间中的玩家列表
   * @param roomId 房间ID
   * @returns 玩家数组
   */
  getPlayersInRoom(roomId: string): Player[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }
    return Array.from(room.players.values());
  }

  /**
   * 获取房间中存活的玩家列表
   * @param roomId 房间ID
   * @returns 存活玩家数组
   */
  getAlivePlayersInRoom(roomId: string): Player[] {
    return this.getPlayersInRoom(roomId).filter(p => p.isAlive);
  }
}
