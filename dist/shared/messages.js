/**
 * 客户端消息类型
 */
export var ClientMessageType;
(function (ClientMessageType) {
    ClientMessageType["JOIN_ROOM"] = "JOIN_ROOM";
    ClientMessageType["LEAVE_ROOM"] = "LEAVE_ROOM";
    ClientMessageType["PLAYER_INPUT"] = "PLAYER_INPUT";
    ClientMessageType["READY"] = "READY";
    ClientMessageType["PING"] = "PING";
})(ClientMessageType || (ClientMessageType = {}));
/**
 * 服务端消息类型
 */
export var ServerMessageType;
(function (ServerMessageType) {
    ServerMessageType["ROOM_JOINED"] = "ROOM_JOINED";
    ServerMessageType["ROOM_LEFT"] = "ROOM_LEFT";
    ServerMessageType["PLAYER_JOINED"] = "PLAYER_JOINED";
    ServerMessageType["PLAYER_LEFT"] = "PLAYER_LEFT";
    ServerMessageType["GAME_STATE"] = "GAME_STATE";
    ServerMessageType["COUNTDOWN"] = "COUNTDOWN";
    ServerMessageType["GAME_START"] = "GAME_START";
    ServerMessageType["GAME_OVER"] = "GAME_OVER";
    ServerMessageType["PLAYER_DIED"] = "PLAYER_DIED";
    ServerMessageType["ERROR"] = "ERROR";
    ServerMessageType["PONG"] = "PONG";
})(ServerMessageType || (ServerMessageType = {}));
/**
 * 消息解析工具函数
 */
export function parseClientMessage(data) {
    try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * 消息序列化工具函数
 */
export function serializeServerMessage(message) {
    return JSON.stringify(message);
}
//# sourceMappingURL=messages.js.map