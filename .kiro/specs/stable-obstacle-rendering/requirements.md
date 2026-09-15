# Requirements Document

## Introduction

修复方块突然变化的问题。当前游戏中，玩家可见的障碍物会突然出现、消失或改变颜色，破坏了游戏体验的连续性。这个问题主要由障碍物ID不一致、客户端缓存同步问题和可见性过滤时机不当造成。

## Glossary

- **Obstacle_ID**: 障碍物唯一标识符，用于跟踪障碍物的生命周期
- **Obstacle_Cache**: 客户端障碍物缓存，存储已知障碍物状态
- **Visibility_Filter**: 可见性过滤器，根据玩家颜色过滤障碍物
- **State_Synchronization**: 服务器与客户端之间的状态同步机制
- **Obstacle_Generator**: 障碍物生成器，负责创建新障碍物
- **Deterministic_ID**: 确定性ID生成，基于位置和种子生成可预测的ID
- **Stable_Rendering**: 稳定渲染，确保障碍物视觉表现的连续性

## Requirements

### Requirement 1: 确定性障碍物ID生成

**User Story:** As a player, I want obstacles to maintain consistent identity, so that they don't suddenly appear or disappear due to ID changes.

#### Acceptance Criteria

1. WHEN generating an obstacle at a specific world position and route THEN THE Obstacle_Generator SHALL create a deterministic ID based on position, route, and seed
2. WHEN the same world position and route are processed multiple times THEN THE Obstacle_Generator SHALL produce the same obstacle ID
3. WHEN different seeds are used THEN THE Obstacle_Generator SHALL produce different IDs for the same position to ensure uniqueness across games
4. THE Obstacle_Generator SHALL use a hash function combining world position, route, and game seed to create stable IDs
5. WHEN obstacles are regenerated during server restart or reconnection THEN THE Obstacle_Generator SHALL produce identical IDs for the same positions

### Requirement 2: 客户端障碍物缓存稳定性

**User Story:** As a player, I want the visual representation of obstacles to remain stable, so that blocks don't flicker or change unexpectedly.

#### Acceptance Criteria

1. WHEN receiving a state update with obstacles THEN THE Obstacle_Cache SHALL merge new obstacles with existing ones based on ID
2. WHEN an obstacle ID already exists in cache THEN THE Obstacle_Cache SHALL update only changed properties and preserve visual continuity
3. WHEN an obstacle is no longer in the server state THEN THE Obstacle_Cache SHALL remove it only after it moves out of visible range
4. THE Obstacle_Cache SHALL maintain obstacle positions and colors consistently between updates
5. WHEN network updates are delayed or lost THEN THE Obstacle_Cache SHALL continue displaying last known obstacle states until confirmed updates arrive

### Requirement 3: 可见性过滤一致性

**User Story:** As a player, I want obstacles to appear and disappear smoothly based on visibility rules, so that the filtering doesn't cause sudden visual changes.

#### Acceptance Criteria

1. WHEN applying visibility filtering THEN THE Visibility_Filter SHALL maintain consistent filtering logic across all state updates
2. WHEN an obstacle becomes visible or invisible due to proximity rules THEN THE Visibility_Filter SHALL apply smooth transitions
3. WHEN multiple players have different visibility rules THEN THE Visibility_Filter SHALL ensure each player receives consistent filtered states
4. THE Visibility_Filter SHALL apply filtering before sending state to clients to prevent client-side visibility changes
5. WHEN proximity hints change THEN THE Visibility_Filter SHALL update them gradually to avoid sudden appearance changes

### Requirement 4: 状态同步优化

**User Story:** As a player, I want game state updates to be smooth and consistent, so that obstacles don't jump or change abruptly during gameplay.

#### Acceptance Criteria

1. WHEN broadcasting game state THEN THE State_Synchronization SHALL include obstacle change deltas rather than full state replacement
2. WHEN an obstacle is newly generated THEN THE State_Synchronization SHALL mark it as "new" to allow proper client-side handling
3. WHEN an obstacle is removed THEN THE State_Synchronization SHALL mark it as "removed" rather than simply omitting it
4. THE State_Synchronization SHALL maintain obstacle update timestamps to handle out-of-order messages
5. WHEN client reconnects after disconnection THEN THE State_Synchronization SHALL provide full state reconciliation without visual disruption

### Requirement 5: 障碍物生命周期管理

**User Story:** As a player, I want obstacles to have predictable lifecycles, so that they don't suddenly appear or vanish without logical reason.

#### Acceptance Criteria

1. WHEN an obstacle is generated THEN THE Obstacle_Generator SHALL create it at a consistent distance ahead of players
2. WHEN an obstacle moves out of the game area THEN THE system SHALL remove it from active state but maintain it in cleanup records
3. WHEN cleaning up old obstacles THEN THE system SHALL ensure they are fully out of all players' visible ranges
4. THE system SHALL maintain obstacle state consistency during the entire lifecycle from generation to cleanup
5. WHEN obstacles are affected by game events (player death, game end) THEN THE system SHALL handle state transitions smoothly

### Requirement 6: 渲染连续性保证

**User Story:** As a player, I want visual rendering to be smooth and continuous, so that obstacles don't flicker or jump between frames.

#### Acceptance Criteria

1. WHEN rendering obstacles THEN THE renderer SHALL use interpolation for position updates to ensure smooth movement
2. WHEN obstacle visibility changes THEN THE renderer SHALL apply fade-in/fade-out effects rather than instant changes
3. WHEN network updates are inconsistent THEN THE renderer SHALL maintain visual stability using prediction and smoothing
4. THE renderer SHALL prioritize visual continuity over immediate state accuracy for minor inconsistencies
5. WHEN obstacles change color due to visibility rules THEN THE renderer SHALL apply smooth color transitions

### Requirement 7: 错误恢复机制

**User Story:** As a player, I want the game to recover gracefully from synchronization errors, so that temporary issues don't permanently break the visual experience.

#### Acceptance Criteria

1. WHEN obstacle state inconsistencies are detected THEN THE system SHALL log the issue and attempt automatic reconciliation
2. WHEN client cache becomes corrupted THEN THE system SHALL request full state refresh from server
3. WHEN server-client synchronization fails THEN THE system SHALL fall back to last known good state
4. THE system SHALL detect and recover from duplicate obstacle IDs or missing obstacles
5. WHEN recovery mechanisms are triggered THEN THE system SHALL minimize visual disruption to the player experience
