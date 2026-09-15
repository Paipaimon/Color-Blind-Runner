# Implementation Plan: Color Blind Runner

## Overview

按照最小可运行原型的目标，分阶段实现多人协作生存游戏。优先实现核心机制（可见性规则、碰撞检测），然后是网络同步，最后是客户端渲染。

## Tasks

- [x] 1. 项目初始化与共享类型定义
  - [x] 1.1 初始化项目结构和依赖
    - 创建 package.json，配置 TypeScript、fast-check、ws 等依赖
    - 创建 tsconfig.json
    - _Requirements: 项目基础设施_

  - [x] 1.2 定义共享类型和常量
    - 创建 src/shared/types.ts（PlayerColor, Player, Obstacle, Room, VisibleState 等）
    - 创建 src/shared/constants.ts（GAME_CONFIG）
    - 创建 src/shared/messages.ts（ClientMessage, ServerMessage）
    - _Requirements: 所有需求的类型基础_

- [x] 2. 实现种子随机数生成器
  - [x] 2.1 实现 SeededRandom 类
    - 创建 src/server/seeded-random.ts
    - 实现可复现的随机数生成
    - _Requirements: 4.4_

  - [ ]* 2.2 编写种子随机数属性测试
    - **Property 6: Random Seed Reproducibility**
    - **Validates: Requirements 4.4**

- [x] 3. 实现路线切换逻辑
  - [x] 3.1 实现 applyInput 函数
    - 创建 src/server/player-logic.ts
    - 实现左移/右移逻辑，包含边界检查
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 3.2 编写路线切换属性测试
    - **Property 3: Route Switching Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 4. 实现障碍物生成器
  - [x] 4.1 实现 ObstacleGenerator 类
    - 创建 src/server/obstacle-generator.ts
    - 使用 SeededRandom 生成障碍物
    - 确保障碍物在可见区域前方生成
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [ ]* 4.2 编写障碍物生成属性测试
    - **Property 5: Obstacle Generation Validity**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**

- [x] 5. 实现碰撞检测器
  - [x] 5.1 实现 CollisionDetector
    - 创建 src/server/collision-detector.ts
    - 检测玩家与同色障碍物的碰撞
    - _Requirements: 6.1_

  - [ ]* 5.2 编写碰撞检测属性测试
    - **Property 9: Collision Detection Correctness**
    - **Validates: Requirements 6.1**

- [-] 6. 实现可见性过滤器
  - [x] 6.1 实现 VisibilityFilter
    - 创建 src/server/visibility-filter.ts
    - 过滤掉玩家自己颜色的障碍物
    - 生成近距离提示
    - _Requirements: 5.1, 5.2, 5.3, 7.1, 8.2_

  - [ ]* 6.2 编写可见性过滤属性测试
    - **Property 7: Visibility Filter Correctness**
    - **Validates: Requirements 5.1, 5.2, 8.2**

  - [ ]* 6.3 编写近距离提示属性测试
    - **Property 8: Proximity Hint Trigger**
    - **Validates: Requirements 5.3**

  - [ ]* 6.4 编写玩家互不可见属性测试
    - **Property 12: Player Invisibility**
    - **Validates: Requirements 7.1**

- [x] 7. Checkpoint - 核心逻辑验证
  - 确保所有属性测试通过，如有问题请询问用户

- [x] 8. 实现房间管理器
  - [x] 8.1 实现 RoomManager 类
    - 创建 src/server/room-manager.ts
    - 实现创建房间、加入房间、颜色分配
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 8.2 编写房间ID唯一性属性测试
    - **Property 1: Room ID Uniqueness**
    - **Validates: Requirements 1.1**

  - [ ]* 8.3 编写颜色分配属性测试
    - **Property 2: Color Assignment Order**
    - **Validates: Requirements 1.1, 1.2**

- [ ] 9. 实现游戏循环
  - [x] 9.1 实现 GameLoop 类
    - 创建 src/server/game-loop.ts
    - 固定时间步长更新世界位置
    - 调用障碍物生成、碰撞检测
    - 更新玩家距离
    - _Requirements: 3.1, 3.2, 6.2, 6.4, 9.1, 9.2_

  - [ ]* 9.2 编写世界滚动属性测试
    - **Property 4: World Scroll Consistency**
    - **Validates: Requirements 3.1**

  - [ ]* 9.3 编写距离追踪属性测试
    - **Property 11: Distance Tracking Correctness**
    - **Validates: Requirements 9.1**

  - [ ]* 9.4 编写死亡状态不变性属性测试
    - **Property 10: Dead Player State Immutability**
    - **Validates: Requirements 6.2, 9.2**

- [x] 10. Checkpoint - 服务器逻辑完成
  - 确保所有服务器端属性测试通过，如有问题请询问用户

- [x] 11. 实现 WebSocket 服务器
  - [x] 11.1 实现服务器入口和消息处理
    - 创建 src/server/index.ts
    - 处理 ClientMessage，发送 ServerMessage
    - 集成 RoomManager 和 GameLoop
    - _Requirements: 8.1, 6.3, 9.3_

- [x] 12. 实现客户端
  - [x] 12.1 实现 WebSocket 客户端
    - 创建 src/client/websocket-client.ts
    - 连接服务器，发送/接收消息
    - _Requirements: 2.5, 8.3, 8.4_

  - [x] 12.2 实现输入处理器
    - 创建 src/client/input-handler.ts
    - 监听键盘事件（左右箭头或A/D）
    - 发送输入到服务器
    - _Requirements: 2.5_

  - [x] 12.3 实现画布渲染器
    - 创建 src/client/canvas-renderer.ts
    - 渲染三条路线、玩家线、可见障碍物、近距离提示
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 12.4 实现客户端入口
    - 创建 src/client/index.ts
    - 创建 public/index.html
    - 集成所有客户端组件
    - _Requirements: 客户端集成_

- [x] 13. 集成测试与最终验证
  - [x] 13.1 编写集成测试
    - 测试完整游戏流程：创建房间 → 加入 → 准备 → 游戏 → 死亡 → 结束
    - _Requirements: 全流程验证_

- [x] 14. Final Checkpoint
  - 确保所有测试通过，游戏可运行，如有问题请询问用户

## Notes

- 标记 `*` 的任务为可选属性测试任务，可跳过以加快MVP开发
- 每个属性测试引用设计文档中的属性编号
- 使用 fast-check 进行属性测试，每个测试至少100次迭代
- 服务器使用 Node.js + ws 库
- 客户端使用原生 Canvas API，不使用游戏引擎
