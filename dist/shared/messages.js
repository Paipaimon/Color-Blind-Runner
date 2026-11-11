/**
 * 客户端消息类型
 */
export var ClientMessageType;
(function (ClientMessageType) {
    ClientMessageType["JOIN_ROOM"] = "JOIN_ROOM";
    ClientMessageType["LEAVE_ROOM"] = "LEAVE_ROOM";
    ClientMessageType["PLAYER_INPUT"] = "PLAYER_INPUT";
    ClientMessageType["READY"] = "READY";
    ClientMessageType["WARN_OBSTACLE"] = "WARN_OBSTACLE";
    ClientMessageType["PING"] = "PING";
})(ClientMessageType || (ClientMessageType = {}));
/**
 * 服务端消息类型
 */
export var ServerMessageType;
(function (ServerMessageType) {
    ServerMessageType["ROOM_JOINED"] = "ROOM_JOINED";
    ServerMessageType["ROOM_LEFT"] = "ROOM_LEFT";
    ServerMessageType["ROOM_STATE"] = "ROOM_STATE";
    ServerMessageType["PLAYER_JOINED"] = "PLAYER_JOINED";
    ServerMessageType["PLAYER_LEFT"] = "PLAYER_LEFT";
    ServerMessageType["GAME_STATE"] = "GAME_STATE";
    ServerMessageType["COUNTDOWN"] = "COUNTDOWN";
    ServerMessageType["GAME_START"] = "GAME_START";
    ServerMessageType["GAME_OVER"] = "GAME_OVER";
    ServerMessageType["PLAYER_DIED"] = "PLAYER_DIED";
    ServerMessageType["ERROR"] = "ERROR";
    ServerMessageType["TEAM_WARNING"] = "TEAM_WARNING";
    ServerMessageType["PONG"] = "PONG";
})(ServerMessageType || (ServerMessageType = {}));
/**
 * 消息解析工具函数
 */
export function parseClientMessage(data) {
    try {
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return null;
        switch (parsed.type) {
            case ClientMessageType.JOIN_ROOM:
                if (parsed.roomId !== undefined && (typeof parsed.roomId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(parsed.roomId)))
                    return null;
                if (parsed.playerName !== undefined && (typeof parsed.playerName !== 'string' || parsed.playerName.length > 40))
                    return null;
                return { type: parsed.type, roomId: parsed.roomId, playerName: parsed.playerName };
            case ClientMessageType.LEAVE_ROOM:
            case ClientMessageType.READY:
                return { type: parsed.type };
            case ClientMessageType.WARN_OBSTACLE:
                return typeof parsed.obstacleId === 'string' && /^obstacle_[0-9]{1,10}$/.test(parsed.obstacleId)
                    ? { type: parsed.type, obstacleId: parsed.obstacleId } : null;
            case ClientMessageType.PING:
                return typeof parsed.timestamp === 'number' && Number.isFinite(parsed.timestamp)
                    ? { type: parsed.type, timestamp: parsed.timestamp } : null;
            case ClientMessageType.PLAYER_INPUT: {
                const input = parsed.input;
                if (!input || ['up', 'down', 'left', 'right'].some(key => typeof input[key] !== 'boolean'))
                    return null;
                return { type: parsed.type, input: { up: input.up, down: input.down, left: input.left, right: input.right } };
            }
            default:
                return null;
        }
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