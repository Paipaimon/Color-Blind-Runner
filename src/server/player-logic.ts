/**
 * 玩家逻辑模块
 * 处理玩家输入和路线切换
 */

import { GAME_CONFIG } from '../shared/constants.js';

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
 * 路线边界
 */
const MIN_ROUTE = 0;
const MAX_ROUTE = GAME_CONFIG.GRID_COLS - 1;

/**
 * 应用玩家输入，计算新的路线位置
 * 
 * @param currentRoute - 当前路线索引
 * @param input - 玩家输入
 * @returns 新的路线索引
 */
export function applyInput(currentRoute: RouteIndex, input: MoveInput): RouteIndex {
  if (input.type === 'move_left') {
    if (currentRoute > MIN_ROUTE) {
      return currentRoute - 1;
    }
    return MIN_ROUTE;
  }
  
  if (input.type === 'move_right') {
    if (currentRoute < MAX_ROUTE) {
      return currentRoute + 1;
    }
    return MAX_ROUTE;
  }
  
  return currentRoute;
}

/**
 * 验证路线索引是否有效
 */
export function isValidRoute(route: number): route is RouteIndex {
  return route >= MIN_ROUTE && route <= MAX_ROUTE && Number.isInteger(route);
}
