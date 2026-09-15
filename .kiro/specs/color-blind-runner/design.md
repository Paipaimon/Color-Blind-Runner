# Design Document: Color Blind Runner

## Overview

这是一个基于 WebSocket 的多人实时协作游戏。服务器采用权威模式，客户端仅负责输入发送和渲染。核心架构分为三层：

1. **Game Server (Node.js + WebSocket)**: 游戏逻辑、状态管理、碰撞检测、可见性过滤
2. **Game Client (TypeScript + Canvas)**: 输入捕获、状态渲染
3. **Shared Types**: 服务器与客户端共享的类型定义

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Game Server                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Room Manager│  │ Game Loop   │  │ Visibility Filter   │ │
│  │ (房间管理)  │  │ (游戏循环)  │  │ (可见性过滤)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Obstacle Gen│  │ Collision   │  │ State Broadcaster   │ │
│  │ (障碍生成)  │  │ (碰撞检测)  │  │ (状态广播)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Game Client                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Input Handler│ │ State Store │  │ Canvas Renderer     │ │
│  │ (输入处理)   │ │ (状态存储)  │  │ (画布渲染)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Server Components

#### RoomManager（房间管理器）

```typescript
// 房间管理器 - 负责创建、加入、离开房间
interface RoomManager {
  // 创建新房间，返回房间ID
  createRoom(): string;
  
  // 加入房间，返回分配的玩家信息
  joinRoom(roomId: string, playerId: string): Player | null;
  
  // 离开房间
  leaveRoom(roomId: string, playerId: string): void;
  
  // 获取房间
  getRoom(roomId: string): Room | null;
  
  // 设置玩家准备状态
  setPlayerReady(roomId: string, playerId: string, ready: boolean): void;
  
  // 检查是否所有玩家都准备好
  areAllPlayersReady(roomId: string): boolean;
}
```

#### GameLoop（游戏循环）

```typescript
// 游戏循环 - 固定时间步长更新
interface GameLoop {
  // 启动游戏循环
  start(room: Room): void;
  
  // 停止游戏循环
  stop(roomId: string): void;
  
  // 单次更新（内部调用）
  tick(room: Room): void;
}
```

#### ObstacleGenerator（障碍物生成器）

```typescript
// 障碍物生成器 - 使用种子随机数生成障碍
interface ObstacleGenerator {
  // 初始化生成器
  init(seed: number, playerColors: PlayerColor[]): void;
  
  // 生成下一批障碍物
  generateNext(worldPosition: number): Obstacle[];
  
  // 重置生成器
  reset(): void;
}
```

#### CollisionDetector（碰撞检测器）

```typescript
// 碰撞检测器 - 检测玩家与障碍物碰撞
interface CollisionDetector {
  // 检测单个玩家的碰撞
  checkCollision(player: Player, obstacles: Obstacle[]): Obstacle | null;
  
  // 检测所有玩家的碰撞
  checkAllCollisions(players: Player[], obstacles: Obstacle[]): CollisionResult[];
}
```

#### VisibilityFilter（可见性过滤器）

```typescript
// 可见性过滤器 - 根据玩家颜色过滤可见内容
interface VisibilityFilter {
  // 为特定玩家生成可见状态
  filterForPlayer(worldState: WorldState, player: Player): VisibleState;
}
```

### Client Components

#### InputHandler（输入处理器）

```typescript
// 输入处理器 - 捕获键盘输入并发送到服务器
interface InputHandler {
  // 绑定键盘事件
  bind(): void;
  
  // 解绑键盘事件
  unbind(): void;
  
  // 发送输入到服务器
  sendInput(input: PlayerInput): void;
}
```

#### CanvasRenderer（画布渲染器）

```typescript
// 画布渲染器 - 渲染可见状态到Canvas
interface CanvasRenderer {
  // 初始化渲染器
  init(canvas: HTMLCanvasElement): void;
  
  // 渲染一帧
  render(visibleState: VisibleState): void;
  
  // 清空画布
  clear(): void;
}
```

## Data Models

### Shared Types（共享类型）

```typescript
// 玩家颜色枚举
enum PlayerColor {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow'
}

// 路线索引 (0=左, 1=中, 2=右)
type RouteIndex = 0 | 1 | 2;

// 玩家状态
interface Player {
  id: string;              // 玩家唯一ID
  color: PlayerColor;      // 玩家颜色
  route: RouteIndex;       // 当前路线 (0/1/2)
  alive: boolean;          // 是否存活
  distance: number;        // 已行进距离
  ready: boolean;          // 是否准备好
}

// 障碍物
interface Obstacle {
  id: string;              // 障碍物唯一ID
  color: PlayerColor;      // 障碍物颜色
  route: RouteIndex;       // 所在路线
  y: number;               // Y坐标（世界坐标）
}

// 近距离提示（自己颜色障碍的微弱提示）
interface ProximityHint {
  route: RouteIndex;       // 提示所在路线
  intensity: number;       // 提示强度 (0-1)
}

// 房间状态
interface Room {
  id: string;              // 房间ID
  players: Player[];       // 玩家列表
  obstacles: Obstacle[];   // 所有障碍物
  worldPosition: number;   // 世界滚动位置
  gameState: GameState;    // 游戏状态
  seed: number;            // 随机种子
}

// 游戏状态枚举
enum GameState {
  WAITING = 'waiting',     // 等待玩家
  PLAYING = 'playing',     // 游戏中
  ENDED = 'ended'          // 游戏结束
}

// 玩家输入
interface PlayerInput {
  type: 'move_left' | 'move_right';
}

// 可见状态（发送给客户端的过滤后状态）
interface VisibleState {
  myPlayer: Player;                    // 自己的玩家信息
  visibleObstacles: Obstacle[];        // 可见的障碍物（不含自己颜色）
  proximityHints: ProximityHint[];     // 近距离提示
  worldPosition: number;               // 世界位置
  gameState: GameState;                // 游戏状态
  scores: PlayerScore[];               // 所有玩家分数（仅游戏结束时有意义）
}

// 玩家分数
interface PlayerScore {
  color: PlayerColor;
  distance: number;
  alive: boolean;
}

// 碰撞结果
interface CollisionResult {
  playerId: string;
  obstacleId: string;
}
```

### WebSocket Messages（WebSocket消息）

```typescript
// 客户端 -> 服务器
type ClientMessage =
  | { type: 'create_room' }
  | { type: 'join_room'; roomId: string }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'input'; input: PlayerInput };

// 服务器 -> 客户端
type ServerMessage =
  | { type: 'room_created'; roomId: string; player: Player }
  | { type: 'room_joined'; roomId: string; player: Player }
  | { type: 'room_full' }
  | { type: 'room_not_found' }
  | { type: 'game_started' }
  | { type: 'state_update'; state: VisibleState }
  | { type: 'player_died'; color: PlayerColor }
  | { type: 'game_ended'; scores: PlayerScore[] };
```



## Game Constants（游戏常量）

```typescript
// 游戏配置常量
const GAME_CONFIG = {
  // 时间相关
  TICK_RATE: 60,                    // 服务器tick频率 (Hz)
  BROADCAST_RATE: 20,               // 状态广播频率 (Hz)
  
  // 世界相关
  WORLD_SPEED: 100,                 // 世界滚动速度 (单位/秒)
  ROUTE_COUNT: 3,                   // 路线数量
  
  // 障碍物相关
  OBSTACLE_SPAWN_DISTANCE: 500,     // 障碍物生成距离（屏幕前方）
  OBSTACLE_MIN_GAP: 50,             // 障碍物最小间距
  OBSTACLE_HEIGHT: 20,              // 障碍物高度
  
  // 可见性相关
  PROXIMITY_HINT_DISTANCE: 100,     // 近距离提示触发距离
  VISIBLE_RANGE: 600,               // 可见范围
  
  // 碰撞相关
  PLAYER_WIDTH: 10,                 // 玩家线宽度
  COLLISION_TOLERANCE: 5,           // 碰撞容差
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*



### Property 1: Room ID Uniqueness（房间ID唯一性）

*For any* sequence of room creation operations, all generated room IDs shall be unique.

**Validates: Requirements 1.1**

### Property 2: Color Assignment Order（颜色分配顺序性）

*For any* room with N players (1 ≤ N ≤ 4), the assigned colors shall be the first N colors from the predefined color sequence (RED, BLUE, GREEN, YELLOW), with no duplicates.

**Validates: Requirements 1.1, 1.2**

### Property 3: Route Switching Correctness（路线切换正确性）

*For any* player at route R and any move input:
- If input is "move_left" and R > 0, then new route = R - 1
- If input is "move_left" and R = 0, then new route = 0
- If input is "move_right" and R < 2, then new route = R + 1
- If input is "move_right" and R = 2, then new route = 2

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 4: World Scroll Consistency（世界滚动一致性）

*For any* two consecutive game ticks with time delta Δt, the world position increment shall equal WORLD_SPEED × Δt.

**Validates: Requirements 3.1**

### Property 5: Obstacle Generation Validity（障碍物生成有效性）

*For any* generated obstacle:
- Its Y position shall be greater than (worldPosition + VISIBLE_RANGE)
- Its route shall be in {0, 1, 2}
- Its color shall be one of the player colors in the current game

**Validates: Requirements 4.1, 4.2, 4.3, 4.5**

### Property 6: Random Seed Reproducibility（随机种子可复现性）

*For any* random seed S and world position sequence, running the obstacle generator twice with the same seed shall produce identical obstacle sequences.

**Validates: Requirements 4.4**

### Property 7: Visibility Filter Correctness（可见性过滤正确性）

*For any* player P with color C and world state W:
- The visible obstacles shall contain all obstacles in W where obstacle.color ≠ C
- The visible obstacles shall contain no obstacles where obstacle.color = C

**Validates: Requirements 5.1, 5.2, 8.2**

### Property 8: Proximity Hint Trigger（近距离提示触发）

*For any* player P with color C and obstacle O where O.color = C:
- If distance(P, O) ≤ PROXIMITY_HINT_DISTANCE, then a proximity hint shall be included
- If distance(P, O) > PROXIMITY_HINT_DISTANCE, then no proximity hint for O shall be included

**Validates: Requirements 5.3**

### Property 9: Collision Detection Correctness（碰撞检测正确性）

*For any* player P with color C at route R and obstacle O:
- If O.color = C AND O.route = R AND positions overlap, then collision shall be detected
- If O.color ≠ C OR O.route ≠ R OR positions don't overlap, then no collision shall be detected

**Validates: Requirements 6.1**

### Property 10: Dead Player State Immutability（死亡玩家状态不变性）

*For any* dead player P, subsequent game ticks shall not change P's route or distance values.

**Validates: Requirements 6.2, 9.2**

### Property 11: Distance Tracking Correctness（距离追踪正确性）

*For any* alive player P, after a game tick with world position increment Δd, P's distance shall increase by Δd.

**Validates: Requirements 9.1**

### Property 12: Player Invisibility（玩家互不可见）

*For any* player P, the visible state projected for P shall not contain position or route information of any other player.

**Validates: Requirements 7.1**

## Error Handling

### Server-Side Errors

| 错误场景 | 处理方式 |
|---------|---------|
| 房间不存在 | 返回 `room_not_found` 消息 |
| 房间已满 | 返回 `room_full` 消息 |
| 无效输入类型 | 忽略该输入 |
| 玩家断开连接 | 标记玩家死亡，继续游戏 |
| WebSocket错误 | 记录日志，清理玩家状态 |

### Client-Side Errors

| 错误场景 | 处理方式 |
|---------|---------|
| 连接断开 | 显示重连提示 |
| 无效服务器消息 | 忽略该消息 |
| 渲染错误 | 记录日志，尝试继续 |

## Testing Strategy

### Unit Tests（单元测试）

单元测试用于验证具体示例和边界条件：

1. **RoomManager Tests**
   - 创建房间返回有效ID
   - 加入满员房间被拒绝
   - 断开连接正确处理

2. **Route Switching Tests**
   - 边界条件：route 0 左移保持不变
   - 边界条件：route 2 右移保持不变

3. **Collision Detection Tests**
   - 精确边界碰撞检测
   - 不同路线不碰撞

4. **Game State Tests**
   - 所有玩家死亡触发游戏结束
   - 游戏结束时分数正确

### Property-Based Tests（属性测试）

使用 **fast-check** 库进行属性测试，每个属性测试至少运行100次迭代。

测试文件结构：
```
src/
├── server/
│   ├── room-manager.ts
│   ├── room-manager.test.ts        # 单元测试
│   ├── room-manager.property.test.ts  # 属性测试
│   ├── game-loop.ts
│   ├── obstacle-generator.ts
│   ├── obstacle-generator.property.test.ts
│   ├── collision-detector.ts
│   ├── collision-detector.property.test.ts
│   ├── visibility-filter.ts
│   └── visibility-filter.property.test.ts
├── shared/
│   └── types.ts
└── client/
    ├── input-handler.ts
    └── canvas-renderer.ts
```

每个属性测试必须包含注释引用设计文档中的属性：
```typescript
// Feature: color-blind-runner, Property 7: Visibility Filter Correctness
// Validates: Requirements 5.1, 5.2, 8.2
```

## File Structure

```
project/
├── package.json
├── tsconfig.json
├── src/
│   ├── server/
│   │   ├── index.ts              # 服务器入口
│   │   ├── room-manager.ts       # 房间管理
│   │   ├── game-loop.ts          # 游戏循环
│   │   ├── obstacle-generator.ts # 障碍物生成
│   │   ├── collision-detector.ts # 碰撞检测
│   │   ├── visibility-filter.ts  # 可见性过滤
│   │   └── seeded-random.ts      # 种子随机数
│   ├── client/
│   │   ├── index.ts              # 客户端入口
│   │   ├── input-handler.ts      # 输入处理
│   │   ├── canvas-renderer.ts    # 画布渲染
│   │   └── websocket-client.ts   # WebSocket客户端
│   └── shared/
│       ├── types.ts              # 共享类型
│       ├── constants.ts          # 游戏常量
│       └── messages.ts           # 消息类型
├── public/
│   └── index.html                # 客户端HTML
└── tests/
    └── *.property.test.ts        # 属性测试
```
