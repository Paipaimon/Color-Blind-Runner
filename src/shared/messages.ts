import { GameState, Player, Obstacle, PlayerColor, Position, VisibleState } from './types.js';

/**
 * 客户端消息类型
 */
export enum ClientMessageType {
  JOIN_ROOM = 'JOIN_ROOM',
  LEAVE_ROOM = 'LEAVE_ROOM',
  PLAYER_INPUT = 'PLAYER_INPUT',
  READY = 'READY',
  PING = 'PING'
}

/**
 * 服务端消息类型
 */
export enum ServerMessageType {
  ROOM_JOINED = 'ROOM_JOINED',
  ROOM_LEFT = 'ROOM_LEFT',
  ROOM_STATE = 'ROOM_STATE',
  PLAYER_JOINED = 'PLAYER_JOINED',
  PLAYER_LEFT = 'PLAYER_LEFT',
  GAME_STATE = 'GAME_STATE',
  COUNTDOWN = 'COUNTDOWN',
  GAME_START = 'GAME_START',
  GAME_OVER = 'GAME_OVER',
  PLAYER_DIED = 'PLAYER_DIED',
  ERROR = 'ERROR',
  PONG = 'PONG'
}

/**
 * 玩家输入方向
 */
export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// ============ 客户端消息 ============

export interface JoinRoomMessage {
  type: ClientMessageType.JOIN_ROOM;
  roomId?: string; // 可选，不提供则自动匹配或创建
  playerName?: string;
}

export interface LeaveRoomMessage {
  type: ClientMessageType.LEAVE_ROOM;
}

export interface PlayerInputMessage {
  type: ClientMessageType.PLAYER_INPUT;
  input: PlayerInput;
}

export interface ReadyMessage {
  type: ClientMessageType.READY;
}

export interface PingMessage {
  type: ClientMessageType.PING;
  timestamp: number;
}

export type ClientMessage =
  | JoinRoomMessage
  | LeaveRoomMessage
  | PlayerInputMessage
  | ReadyMessage
  | PingMessage;

// ============ 服务端消息 ============

export interface RoomJoinedMessage {
  type: ServerMessageType.ROOM_JOINED;
  roomId: string;
  playerId: string;
  playerColor: PlayerColor;
  players: Player[];
}

export interface RoomLeftMessage {
  type: ServerMessageType.ROOM_LEFT;
}

export interface PlayerJoinedMessage {
  type: ServerMessageType.PLAYER_JOINED;
  player: Player;
}

export interface PlayerLeftMessage {
  type: ServerMessageType.PLAYER_LEFT;
  playerId: string;
}

export interface GameStateMessage {
  type: ServerMessageType.GAME_STATE;
  state: VisibleState;
  timestamp: number;
}

export interface CountdownMessage {
  type: ServerMessageType.COUNTDOWN;
  seconds: number;
}

export interface GameStartMessage {
  type: ServerMessageType.GAME_START;
}

export interface GameOverMessage {
  type: ServerMessageType.GAME_OVER;
  winners: string[]; // 存活玩家ID列表
  finalState: VisibleState;
}

export interface PlayerDiedMessage {
  type: ServerMessageType.PLAYER_DIED;
  playerId: string;
  killedBy: string; // 障碍物ID
}

export interface ErrorMessage {
  type: ServerMessageType.ERROR;
  code: string;
  message: string;
}

export interface PongMessage {
  type: ServerMessageType.PONG;
  timestamp: number;
  serverTime: number;
}

export interface RoomStateMessage {
  type: ServerMessageType.ROOM_STATE;
  state: VisibleState;
}

export type ServerMessage =
  | RoomJoinedMessage
  | RoomLeftMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | GameStateMessage
  | CountdownMessage
  | GameStartMessage
  | GameOverMessage
  | PlayerDiedMessage
  | ErrorMessage
  | PongMessage
  | RoomStateMessage;

/**
 * 消息解析工具函数
 */
export function parseClientMessage(data: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    switch (parsed.type) {
      case ClientMessageType.JOIN_ROOM:
        if (parsed.roomId !== undefined && (typeof parsed.roomId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(parsed.roomId))) return null;
        if (parsed.playerName !== undefined && (typeof parsed.playerName !== 'string' || parsed.playerName.length > 40)) return null;
        return { type: parsed.type, roomId: parsed.roomId, playerName: parsed.playerName };
      case ClientMessageType.LEAVE_ROOM:
      case ClientMessageType.READY:
        return { type: parsed.type };
      case ClientMessageType.PING:
        return typeof parsed.timestamp === 'number' && Number.isFinite(parsed.timestamp)
          ? { type: parsed.type, timestamp: parsed.timestamp } : null;
      case ClientMessageType.PLAYER_INPUT: {
        const input = parsed.input;
        if (!input || ['up', 'down', 'left', 'right'].some(key => typeof input[key] !== 'boolean')) return null;
        return { type: parsed.type, input: { up: input.up, down: input.down, left: input.left, right: input.right } };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * 消息序列化工具函数
 */
export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
