# Requirements Document

## Introduction

多人协作生存游戏：玩家在纵向滚动的世界中控制一条向上延伸的线，在三条固定路线间切换躲避障碍。核心机制是颜色可见性规则——玩家看不到自己颜色的障碍，只能看到其他玩家颜色的障碍，因此必须通过语音/文字交流来互相提醒危险。

## Glossary

- **Game_Server**: 游戏服务器，负责所有游戏逻辑、状态管理和同步
- **Game_Client**: 游戏客户端，负责渲染和输入发送
- **Player**: 玩家实体，包含颜色、当前路线、存活状态
- **Player_Line**: 玩家的视觉表现，从屏幕底部向上延伸的直线
- **Route**: 路线，屏幕上的三条固定垂直通道（左=0 / 中=1 / 右=2）
- **Obstacle**: 障碍物，带有颜色属性，与同色玩家碰撞会导致死亡
- **World_State**: 世界状态，包含所有玩家和障碍物的完整信息
- **Visible_State**: 可见状态，针对特定玩家过滤后的投影数据
- **Color**: 玩家颜色，用于区分玩家和障碍物的可见性

## Requirements

### Requirement 1: 游戏房间管理

**User Story:** As a player, I want to create or join a game room, so that I can play with 1-4 players.

#### Acceptance Criteria

1. WHEN a player creates a room THEN THE Game_Server SHALL generate a unique room ID and assign the first available color to the player
2. WHEN a player joins a room with available slots THEN THE Game_Server SHALL assign the next available color to the player
3. WHEN a room has 4 players THEN THE Game_Server SHALL reject new join requests
4. WHEN all players in a room indicate ready THEN THE Game_Server SHALL start the game
5. IF a player disconnects during game THEN THE Game_Server SHALL mark that player as dead and continue the game

### Requirement 2: 玩家输入与路线切换

**User Story:** As a player, I want to switch between three routes using simple controls, so that I can dodge obstacles.

#### Acceptance Criteria

1. WHEN a player sends a "move left" input THEN THE Game_Server SHALL decrease the player's route index by 1 if not already at route 0
2. WHEN a player sends a "move right" input THEN THE Game_Server SHALL increase the player's route index by 1 if not already at route 2
3. WHEN a player is at route 0 and sends "move left" THEN THE Game_Server SHALL keep the player at route 0
4. WHEN a player is at route 2 and sends "move right" THEN THE Game_Server SHALL keep the player at route 2
5. THE Game_Client SHALL only send input commands and SHALL NOT modify local game state

### Requirement 3: 世界滚动与前进

**User Story:** As a player, I want the world to scroll upward at a constant speed, so that I experience continuous forward movement.

#### Acceptance Criteria

1. THE Game_Server SHALL advance the world position at a constant speed for all players
2. WHEN the game is running THEN THE Game_Server SHALL update world position every tick (fixed timestep)
3. THE Player_Line SHALL visually extend from the bottom of the screen upward as the world scrolls

### Requirement 4: 障碍物生成

**User Story:** As a player, I want obstacles to appear ahead, so that I have challenges to avoid.

#### Acceptance Criteria

1. THE Game_Server SHALL generate obstacles at random positions ahead of the visible area
2. WHEN generating an obstacle THEN THE Game_Server SHALL assign it to one of the three routes
3. WHEN generating an obstacle THEN THE Game_Server SHALL assign it a color matching one of the players in the game
4. THE Game_Server SHALL use a seeded random number generator for obstacle generation to ensure reproducibility
5. WHEN a player dies THEN THE Game_Server SHALL continue generating obstacles of that player's color

### Requirement 5: 颜色可见性规则

**User Story:** As a player, I want to see only other players' colored obstacles, so that I must rely on teammates to warn me about my own dangers.

#### Acceptance Criteria

1. WHEN projecting visible state for a player THEN THE Game_Server SHALL exclude obstacles matching that player's color
2. WHEN projecting visible state for a player THEN THE Game_Server SHALL include obstacles of all other players' colors
3. WHEN an obstacle of the player's own color is very close (within warning distance) THEN THE Game_Server SHALL include a minimal hint in the visible state
4. THE Game_Client SHALL render only the obstacles present in the received Visible_State
5. THE Game_Client SHALL NOT have access to the complete World_State

### Requirement 6: 碰撞检测与死亡

**User Story:** As a player, I want to die when I collide with my own colored obstacle, so that the game has meaningful consequences.

#### Acceptance Criteria

1. WHEN a player's position overlaps with an obstacle of the same color THEN THE Game_Server SHALL mark that player as dead
2. WHEN a player dies THEN THE Game_Server SHALL stop updating that player's position
3. WHEN a player dies THEN THE Game_Server SHALL notify all clients of the death event
4. WHEN all players are dead THEN THE Game_Server SHALL end the game and report final scores

### Requirement 7: 玩家互不可见

**User Story:** As a player, I want to not see other players' lines, so that the game focuses on verbal communication.

#### Acceptance Criteria

1. WHEN projecting visible state for a player THEN THE Game_Server SHALL exclude other players' line positions
2. THE Game_Client SHALL only render the local player's own line
3. THE Game_Client SHALL NOT display any indication of other players' current routes

### Requirement 8: 游戏状态同步

**User Story:** As a player, I want to receive real-time game updates, so that my view stays synchronized with the server.

#### Acceptance Criteria

1. THE Game_Server SHALL broadcast Visible_State to each client at a fixed tick rate
2. WHEN sending state to a client THEN THE Game_Server SHALL filter the World_State based on that player's color
3. THE Game_Client SHALL render the received Visible_State without modification
4. WHEN receiving state updates THEN THE Game_Client SHALL replace the previous state entirely (no client-side prediction)

### Requirement 9: 计分与游戏结束

**User Story:** As a player, I want to see my survival distance/time, so that I can measure my performance.

#### Acceptance Criteria

1. THE Game_Server SHALL track the distance traveled for each player
2. WHEN a player dies THEN THE Game_Server SHALL record that player's final distance
3. WHEN the game ends THEN THE Game_Server SHALL send final scores to all clients
4. THE Game_Client SHALL display the final scores when the game ends

### Requirement 10: 客户端渲染

**User Story:** As a player, I want to see a clear visual representation of the game, so that I can make decisions.

#### Acceptance Criteria

1. THE Game_Client SHALL render the three routes as distinct vertical lanes
2. THE Game_Client SHALL render the player's own line extending from the bottom
3. THE Game_Client SHALL render visible obstacles with their assigned colors
4. THE Game_Client SHALL render the current distance/score
5. WHEN rendering THEN THE Game_Client SHALL only read from the projected Visible_State
