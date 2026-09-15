/**
 * 玩家逻辑模块
 * 处理玩家输入和路线切换
 */
/**
 * 路线索引类型 (0 到 GRID_COLS-1)
 */
export type RouteIndex = number;
/**
 * 玩家输入类型
 */
export interface MoveInput {
    type: 'move_left' | 'move_right';
}
/**
 * 应用玩家输入，计算新的路线位置
 *
 * @param currentRoute - 当前路线索引
 * @param input - 玩家输入
 * @returns 新的路线索引
 */
export declare function applyInput(currentRoute: RouteIndex, input: MoveInput): RouteIndex;
/**
 * 验证路线索引是否有效
 */
export declare function isValidRoute(route: number): route is RouteIndex;
//# sourceMappingURL=player-logic.d.ts.map