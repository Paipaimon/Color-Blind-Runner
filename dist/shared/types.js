/**
 * 玩家颜色枚举
 * 每个玩家被分配一种颜色，决定其可见性规则
 */
export var PlayerColor;
(function (PlayerColor) {
    PlayerColor["RED"] = "RED";
    PlayerColor["GREEN"] = "GREEN";
    PlayerColor["BLUE"] = "BLUE";
    PlayerColor["YELLOW"] = "YELLOW";
})(PlayerColor || (PlayerColor = {}));
/**
 * 障碍物颜色枚举
 * 障碍物颜色决定哪些玩家可以看到它
 */
export var ObstacleColor;
(function (ObstacleColor) {
    ObstacleColor["RED"] = "RED";
    ObstacleColor["GREEN"] = "GREEN";
    ObstacleColor["BLUE"] = "BLUE";
    ObstacleColor["YELLOW"] = "YELLOW";
    ObstacleColor["CYAN"] = "CYAN";
    ObstacleColor["MAGENTA"] = "MAGENTA";
    ObstacleColor["WHITE"] = "WHITE"; // 所有玩家可见
})(ObstacleColor || (ObstacleColor = {}));
/**
 * 游戏状态枚举
 */
export var GameState;
(function (GameState) {
    GameState["WAITING"] = "WAITING";
    GameState["COUNTDOWN"] = "COUNTDOWN";
    GameState["PLAYING"] = "PLAYING";
    GameState["GAME_OVER"] = "GAME_OVER";
})(GameState || (GameState = {}));
/**
 * 颜色可见性映射
 * 定义每种玩家颜色可以看到哪些障碍物颜色
 */
export const COLOR_VISIBILITY = {
    [PlayerColor.RED]: [
        ObstacleColor.RED,
        ObstacleColor.YELLOW,
        ObstacleColor.MAGENTA,
        ObstacleColor.WHITE
    ],
    [PlayerColor.GREEN]: [
        ObstacleColor.GREEN,
        ObstacleColor.YELLOW,
        ObstacleColor.CYAN,
        ObstacleColor.WHITE
    ],
    [PlayerColor.BLUE]: [
        ObstacleColor.BLUE,
        ObstacleColor.CYAN,
        ObstacleColor.MAGENTA,
        ObstacleColor.WHITE
    ],
    [PlayerColor.YELLOW]: [
        ObstacleColor.YELLOW,
        ObstacleColor.WHITE
    ]
};
//# sourceMappingURL=types.js.map