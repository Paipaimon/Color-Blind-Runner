import { Player, PlayerColor, VisibleState } from './types.js';
/**
 * 客户端消息类型
 */
export declare enum ClientMessageType {
    JOIN_ROOM = "JOIN_ROOM",
    LEAVE_ROOM = "LEAVE_ROOM",
    PLAYER_INPUT = "PLAYER_INPUT",
    READY = "READY",
    PING = "PING"
}
/**
 * 服务端消息类型
 */
export declare enum ServerMessageType {
    ROOM_JOINED = "ROOM_JOINED",
    ROOM_LEFT = "ROOM_LEFT",
    PLAYER_JOINED = "PLAYER_JOINED",
    PLAYER_LEFT = "PLAYER_LEFT",
    GAME_STATE = "GAME_STATE",
    COUNTDOWN = "COUNTDOWN",
    GAME_START = "GAME_START",
    GAME_OVER = "GAME_OVER",
    PLAYER_DIED = "PLAYER_DIED",
    ERROR = "ERROR",
    PONG = "PONG"
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
export interface JoinRoomMessage {
    type: ClientMessageType.JOIN_ROOM;
    roomId?: string;
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
export type ClientMessage = JoinRoomMessage | LeaveRoomMessage | PlayerInputMessage | ReadyMessage | PingMessage;
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
    winners: string[];
    finalState: VisibleState;
}
export interface PlayerDiedMessage {
    type: ServerMessageType.PLAYER_DIED;
    playerId: string;
    killedBy: string;
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
export type ServerMessage = RoomJoinedMessage | RoomLeftMessage | PlayerJoinedMessage | PlayerLeftMessage | GameStateMessage | CountdownMessage | GameStartMessage | GameOverMessage | PlayerDiedMessage | ErrorMessage | PongMessage;
/**
 * 消息解析工具函数
 */
export declare function parseClientMessage(data: string): ClientMessage | null;
/**
 * 消息序列化工具函数
 */
export declare function serializeServerMessage(message: ServerMessage): string;
//# sourceMappingURL=messages.d.ts.map