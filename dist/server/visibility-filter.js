/**
 * 可见性过滤器
 * 根据玩家颜色过滤世界状态，生成玩家可见的投影数据
 */
/**
 * 游戏状态枚举
 */
export var GameState;
(function (GameState) {
    GameState["WAITING"] = "waiting";
    GameState["PLAYING"] = "playing";
    GameState["ENDED"] = "ended";
})(GameState || (GameState = {}));
/**
 * 可见性配置（网格单位）
 */
const VISIBILITY_CONFIG = {
    PROXIMITY_HINT_DISTANCE: 3, // 近距离提示触发距离（网格行数）
    VISIBLE_RANGE: 15, // 可见范围（网格行数）
};
/**
 * 可见性过滤器类
 *
 * 核心职责：
 * 1. 过滤掉玩家自己颜色的障碍物 (Requirements 5.1, 5.2)
 * 2. 生成近距离提示 (Requirements 5.3)
 * 3. 排除其他玩家的位置信息 (Requirements 7.1)
 * 4. 根据玩家颜色过滤世界状态 (Requirements 8.2)
 */
export class VisibilityFilter {
    /**
     * 为特定玩家生成可见状态
     *
     * @param worldState 完整的世界状态
     * @param player 目标玩家
     * @returns 过滤后的可见状态
     *
     * Requirements: 5.1, 5.2, 5.3, 7.1, 8.2
     */
    filterForPlayer(worldState, player) {
        // Requirements 5.1, 5.2: 过滤障碍物 - 排除玩家自己颜色的障碍物
        const visibleObstacles = this.filterObstacles(worldState.obstacles, player.color);
        // Requirements 5.3: 生成近距离提示
        const proximityHints = this.generateProximityHints(worldState.obstacles, player);
        // Requirements 7.1: 不包含其他玩家的位置信息
        // 只返回当前玩家自己的信息，不暴露其他玩家
        // 生成分数列表（只包含颜色和距离，不包含位置）
        const scores = this.generateScores(worldState.players);
        return {
            myPlayer: player,
            visibleObstacles,
            proximityHints,
            worldPosition: worldState.worldPosition,
            gameState: worldState.gameState,
            scores
        };
    }
    /**
     * 过滤障碍物 - 排除玩家自己颜色的障碍物
     *
     * @param obstacles 所有障碍物
     * @param playerColor 玩家颜色
     * @returns 玩家可见的障碍物列表
     *
     * Requirements: 5.1 - 排除自己颜色的障碍物
     * Requirements: 5.2 - 包含其他颜色的障碍物
     */
    filterObstacles(obstacles, playerColor) {
        return obstacles.filter(obstacle => obstacle.color !== playerColor);
    }
    /**
     * 生成近距离提示
     * 当玩家自己颜色的障碍物非常接近时，提供微弱提示
     *
     * @param obstacles 所有障碍物
     * @param player 目标玩家
     * @returns 近距离提示列表
     *
     * Requirements: 5.3 - 近距离提示
     */
    generateProximityHints(obstacles, player) {
        const hints = [];
        // 只检查玩家自己颜色的障碍物
        const ownColorObstacles = obstacles.filter(obstacle => obstacle.color === player.color);
        for (const obstacle of ownColorObstacles) {
            // 计算玩家与障碍物的距离
            const distance = this.calculateDistance(player, obstacle);
            // 如果在提示距离内，生成提示
            if (distance <= VISIBILITY_CONFIG.PROXIMITY_HINT_DISTANCE) {
                // 计算提示强度：距离越近，强度越高 (0-1)
                const intensity = 1 - (distance / VISIBILITY_CONFIG.PROXIMITY_HINT_DISTANCE);
                hints.push({
                    route: obstacle.route,
                    intensity: Math.max(0, Math.min(1, intensity)) // 确保在 0-1 范围内
                });
            }
        }
        return hints;
    }
    /**
     * 计算玩家与障碍物之间的距离
     *
     * @param player 玩家
     * @param obstacle 障碍物
     * @returns 距离值
     */
    calculateDistance(player, obstacle) {
        // 玩家位置基于其行进距离
        const playerY = player.distance;
        // 计算Y轴距离（障碍物在玩家前方为正）
        return Math.abs(obstacle.y - playerY);
    }
    /**
     * 生成玩家分数列表
     * 只包含颜色、距离和存活状态，不包含位置信息
     *
     * @param players 所有玩家
     * @returns 分数列表
     *
     * Requirements: 7.1 - 不暴露其他玩家的路线位置
     */
    generateScores(players) {
        return players.map(p => ({
            color: p.color,
            distance: p.distance,
            alive: p.alive
        }));
    }
    /**
     * 获取可见性配置常量（用于测试）
     */
    static getVisibilityConfig() {
        return VISIBILITY_CONFIG;
    }
}
//# sourceMappingURL=visibility-filter.js.map