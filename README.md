# Color Blind Runner - 多人协作生存游戏

## 项目概述

Color Blind Runner 是一个基于「颜色盲区」规则的多人在线生存游戏。

每一局中，每位玩家会被分配一种颜色（红 / 绿 / 蓝 / 黄）。**玩家看不到与自己同色的障碍物**——而撞上同色障碍物恰恰就是唯一的死亡方式。也就是说，致命障碍对玩家而言是「隐形」的，必须依靠其他玩家（他们能看到你的颜色）的提醒来躲避。

游戏为服务器权威（Server-authoritative）架构：所有规则判定在服务端完成，客户端只负责发送输入和渲染服务端投影后的可见数据。

### 核心玩法

- **颜色盲区机制**：玩家看不到自己颜色的障碍物，只能看到其他颜色的障碍物
- **多人协作**：其他玩家能看到你看不见的障碍物，需要靠沟通/提醒生存
- **三路线跑酷**：玩家在 3 条纵向车道间左右切换，躲避滚动而来的障碍物
- **生存挑战**：世界以恒定速度滚动，尽可能活得久、跑得远
- **实时同步**：服务端定时广播可见状态；死亡后进入观战视角
- **危险提示**：当自己颜色的（不可见）障碍物逼近时，屏幕出现危险预警

## 技术架构

### 前端技术栈

- **TypeScript** - 类型安全
- **Canvas 2D API** - 游戏画面渲染（固定内部分辨率 1280×720，通过 CSS 缩放适配屏幕）
- **原生 DOM + CSS** - 状态栏 / 操作按钮 / 连接状态等界面层，无前端框架
- **WebSocket** - 实时双向通信
- **响应式设计** - 移动端适配、横竖屏切换

### 后端技术栈

- **Node.js** - 服务器运行时（同时承担 HTTP 静态文件服务与 WebSocket 服务）
- **ws** - WebSocket 服务器
- **TypeScript** - 服务端类型安全

### 项目结构

```
blind-line-game/
├── public/
│   └── index.html              # 页面骨架 + 设计令牌/样式（状态栏、操作按钮、连接状态、断线遮罩）
├── src/
│   ├── shared/                 # 前后端共享
│   │   ├── types.ts            # 玩家/障碍物/房间/可见状态类型，颜色枚举
│   │   ├── messages.ts         # 客户端-服务端消息协议与解析工具
│   │   └── constants.ts        # 游戏配置常量（网格、速度、端口等）
│   ├── server/                 # 服务端
│   │   ├── index.ts            # 入口：HTTP 静态服务 + WebSocket + 房间/游戏循环编排
│   │   ├── room-manager.ts     # 房间创建/加入/离开、颜色分配、准备与开局
│   │   ├── game-loop.ts        # 固定步长主循环：世界滚动、障碍物、碰撞、结算
│   │   ├── obstacle-generator.ts # 基于种子随机数的障碍物生成
│   │   ├── collision-detector.ts # 同色同路线碰撞检测
│   │   ├── visibility-filter.ts  # 按玩家颜色过滤障碍物、生成危险提示
│   │   ├── player-logic.ts     # 路线切换边界逻辑
│   │   ├── seeded-random.ts    # Mulberry32 可复现随机数
│   │   └── collision-detector.test.ts # 碰撞检测单元测试
│   └── client/                 # 客户端
│       ├── index.ts            # 入口：编排渲染、输入、网络、状态栏与界面控件
│       ├── websocket-client.ts # WebSocket 连接与消息收发
│       ├── input-handler.ts    # 键盘输入（方向键 / WASD）
│       ├── touch-handler.ts    # 触控滑动输入
│       ├── touch-feedback.ts   # 触控视觉反馈（波纹 + 方向指示）
│       ├── input-merger.ts     # 键盘与触控输入合并
│       ├── input-merger.test.ts# 输入合并单元测试
│       ├── canvas-renderer.ts  # Canvas 渲染（主题、车道、路径、障碍物、距离、遮罩）
│       ├── viewport-manager.ts # 视口/尺寸/设备适配
│       └── status-bar-renderer.ts # 状态栏 DOM 渲染（按数据槽增量更新）
├── docs/ui/                    # 界面样张（大厅与对局状态）
├── scripts/debug/              # 调试辅助脚本（投放脚本玩家、无头截图）
├── dist/                       # TypeScript 编译输出（服务器实际加载此处）
├── verify-input-merger.js      # 输入合并逻辑的独立验证脚本
├── tsconfig.json
└── package.json
```

## 游戏规则

### 颜色可见性规则（核心）

障碍物颜色从**本局玩家颜色集合**中随机选取。每位玩家：

| 玩家颜色 | 不可见（且致命）障碍物 | 可见障碍物 |
|---------|----------------------|-----------|
| 红色 (RED) | 红色 | 其他玩家颜色的全部障碍物 |
| 绿色 (GREEN) | 绿色 | 其他玩家颜色的全部障碍物 |
| 蓝色 (BLUE) | 蓝色 | 其他玩家颜色的全部障碍物 |
| 黄色 (YELLOW) | 黄色 | 其他玩家颜色的全部障碍物 |

过滤逻辑实现于 [visibility-filter.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/server/visibility-filter.ts)：`filterObstacles()` 直接排除与玩家自身颜色相同的障碍物。

### 碰撞与死亡

只有同时满足以下三个条件才会死亡（见 [collision-detector.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/server/collision-detector.ts)）：

1. 障碍物颜色与玩家颜色**相同**（即玩家看不见的那个颜色）
2. 障碍物与玩家位于**同一条路线**（列）
3. 纵向位置重叠（容差 0.5 个网格单位）

即「看得见的都撞不死，撞得死的都看不见」。

### 危险提示（Proximity Hint）

当自己颜色的障碍物距离玩家 3 个网格行以内时，服务端会下发提示（含所在路线与强度 0~1）。客户端据此将游戏区域边框变红加粗，作为「看不见的威胁正在逼近」的唯一预警。实现见 [visibility-filter.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/server/visibility-filter.ts) 与 [canvas-renderer.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/canvas-renderer.ts)。

## 游戏功能特性

### 房间系统

- 支持 **2~4 人**同局（`MIN_PLAYERS = 2`，`MAX_PLAYERS = 4`）
- 自动匹配未满房间，否则创建新房间；也可通过消息指定 `roomId` 加入
- 颜色按加入顺序依次分配：**红 → 蓝 → 黄 → 绿**
- 准备机制：所有玩家准备且人数达标后，进入 **3 秒倒计时**再开局
- 游戏进行中掉线视为死亡，并广播 `PLAYER_DIED`（`killedBy: 'disconnect'`）

### 输入系统

- **键盘**：[input-handler.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/input-handler.ts) 监听方向键与 WASD；服务端实际只消费左右方向（路线切换），上下键当前不产生位移
- **触控**：[touch-handler.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/touch-handler.ts) 识别左右滑动手势（最小距离 30px、最长 300ms、50ms 防抖），垂直滑动默认关闭
- **输入合并**：[input-merger.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/input-merger.ts) 对键盘与触控做逻辑或（OR）合并，仅在合并结果变化时才发送，避免重复消息
- **准备 / 重开**：空格键 / 回车、点击底部操作按钮、点击画布或触摸画布

### 渲染系统

渲染器固定在 1280×720 逻辑坐标系上绘制（画布内部分辨率会按显示尺寸与像素比同步，保证清晰度），实际显示尺寸由 CSS 按 16:9 缩放。

- 玩家固定在屏幕底部，世界向上滚动、障碍物自上而下迎面而来
- 玩家表现为一条**按自身颜色着色的线**（换道处形成带辉光的折角），并向屏幕下方延伸出走过的轨迹
- 车道网格跟随世界滚动：横线与障碍物同速同向（整数世界行即格子中心，障碍物正好落在格子里），
  竖线随玩家横向移动平移半格，使格子保持正方形并与车道中心对齐
- 右侧留白处实时显示距离；三条车道有边框与分隔线
- 依次渲染：等待 / 倒计时 / 进行中 / 游戏结束四种画面
- 情绪化反馈：危险时车道边框转为警示色并随强度增强、死亡时叠加红色遮罩并提示「你已死亡 / 正在观战 / 最终距离」

### 画面流畅度（帧率）

服务端以 20Hz 广播状态，如果直接按广播重绘，画面每秒只会动 20 次。客户端为此做了一层**纯视觉**的平滑处理：

| 手段 | 说明 |
|------|------|
| 广播间推帧 | 由相邻两次广播的位置差估算世界速度，在两个广播之间按显示刷新率（通常 60Hz）外推**取景位置**，每收到广播即与服务端权威位置对齐；外推值永不超过服务端最新位置 |
| 静态画面不重绘 | 等待 / 倒计时 / 结束画面完全静态，不启动推帧循环；`requestAnimationFrame` 循环仅在 `PLAYING` 期间运行 |
| 绘制开销 | 背景与遮罩渐变创建一次后缓存复用，避免每帧重建 `CanvasGradient` |
| 过渡帧不做重复工作 | 推帧时不重复写入状态栏、按钮等 DOM，这些只在收到广播时更新一次 |

推帧只影响"世界坐标 → 屏幕坐标"的取景换算，**不修改任何游戏数据、不做碰撞判定、不预测输入结果**，服务器权威性不受影响。

### 状态栏

[status-bar-renderer.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/status-bar-renderer.ts) 以 DOM 形式渲染，按数据槽增量更新，并按阶段切换信息层级：

| 阶段 | 呈现内容 |
|------|---------|
| 等待 / 倒计时 | 在线人数（含占用点位）、已准备人数、房间号、状态胶囊（等待玩家 / 可准备 / 即将开始 / 倒计时 N） |
| 进行中 | 自身颜色、游玩人数、距离、存活时间、状态胶囊（进行中 / 已死亡 · 观战） |
| 结束 | 最终距离、存活时间、移动次数、个人最佳对比（新纪录提示） |

个人最佳存储于 `localStorage` 的 `colorBlindRunner_personalBest`。

### 界面层（UI 重构后）

界面分为四层，游戏逻辑与渲染数据流不受界面改动影响：

| 区域 | 承载内容 | 实现 |
|------|---------|------|
| 顶部品牌栏 | 四色标识 + 连接状态灯（连接中 / 已连接 / 连接已断开） | `public/index.html` + [index.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/index.ts) |
| 状态栏 HUD | 大厅：在线人数、已准备人数、房间号、状态胶囊；对局中：游玩人数、距离、存活时间、自身颜色；结束：最终成绩与个人最佳对比 | [status-bar-renderer.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/status-bar-renderer.ts) |
| 游戏舞台 | 1280×720 画布，按 16:9 自适应舞台 | [canvas-renderer.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/canvas-renderer.ts) |
| 底部操作区 | 主操作按钮（准备 / 已准备 / 倒计时 / 游戏进行中 / 重新开始）+ 按键提示 | [index.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/index.ts) |

界面样张见 [docs/ui](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/docs/ui)：`lobby-desktop.png`、`lobby-mobile.png`、`hud-playing.png`、`state-playing.png`、`state-danger.png`、`state-dead.png`。

设计要点：

- **只回答一个问题**：状态栏按阶段只呈现当下最关心的数字——大厅看"几个人、几个准备了"，对局看"几个人在玩、跑了多远、活了多久"，房间号在对局中自动让位
- **人数来源**：在线/已准备人数由服务端广播（`ROOM_JOINED` / `PLAYER_JOINED` / `PLAYER_LEFT`）加本机准备动作在客户端聚合，仅用于展示，不参与任何判定
- **状态可读性**：状态栏不再每帧重建 DOM，改为构造时建立数据槽、渲染时增量写入文本与类名，避免样式抖动
- **危险提示**：自己颜色的障碍物逼近时，车道边框转为警示色并随强度增强（唯一的危险反馈，不含方向引导）
- **颜色即信息**：四种玩家颜色在 UI 与画布中一致，且不额外标注障碍物信息，避免削弱"颜色盲区"这一核心机制
- **移动端**：竖屏时状态栏改为纵向堆叠，画布按舞台实测尺寸推导；横屏矮屏时隐藏品牌栏与提示以保住画面高度
- **可访问性**：主操作为原生 `button`（支持键盘聚焦与回车触发），空格 / 回车与点击画布同样可触发准备与重开

### 网络同步

- **服务器权威**：世界滚动、障碍物生成、碰撞判定全部在服务端
- 客户端只发送 `PLAYER_INPUT`，不修改世界状态、不做碰撞判定
- 状态广播中，每个玩家的障碍物列表按其颜色单独过滤
- 死亡玩家仍持续收到状态更新，并以自己死亡时的距离作为视角位置，实现观战

### 移动端适配

[viewport-manager.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/viewport-manager.ts) 负责：

- 动态写入 `viewport` meta（禁用缩放、`viewport-fit=cover`）
- 竖屏移动端画布占屏高约 80%，其余场景按 16:9 适配并预留状态栏空间
- 通过 `ResizeObserver` 与 `orientationchange` 监听尺寸/方向变化并重新布局
- 屏蔽双击缩放与手势缩放

## 关键配置

来源：[constants.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/shared/constants.ts) 与 [game-loop.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/server/game-loop.ts)。

| 配置项 | 值 | 说明 |
|-------|-----|------|
| `GRID_COLS` | 3 | 路线（车道）数量 |
| `GRID_ROWS` | 12 | 可见网格行数 |
| `CELL_SIZE` | 60 | 单元格像素尺寸 |
| `GAME_WIDTH` / `GAME_HEIGHT` | 1280 / 720 | 游戏区域尺寸（16:9） |
| `GAME_AREA_OFFSET` | 550 | 3 列居中后的左侧偏移 |
| `MIN_PLAYERS` / `MAX_PLAYERS` | 2 / 4 | 房间人数范围 |
| `COUNTDOWN_SECONDS` | 3 | 开局倒计时 |
| `DEFAULT_PORT` | 8000 | 服务端端口（可用环境变量 `PORT` 覆盖） |
| `TICK_RATE` | 60 | 逻辑帧率（Hz） |
| `WORLD_SPEED` | 3 | 世界滚动速度（网格行/秒） |
| `BROADCAST_RATE` | 20 | 状态广播频率（Hz） |
| `SPAWN_DISTANCE` | 10 | 障碍物提前生成距离（行） |
| `OBSTACLE_MIN_GAP` | 2 | 障碍物最小间隔（行），实际间隔 3~4 行 |
| `PROXIMITY_HINT_DISTANCE` | 3 | 危险提示触发距离（行） |

## 开发和部署

### 环境要求

- Node.js 18+
- TypeScript 5.0+
- 现代浏览器（需支持 WebSocket、Canvas、ES Module）

### 常用命令

```bash
# 安装依赖
npm install

# 编译 TypeScript 到 dist/
npm run build

# 启动服务器（运行编译产物）
npm run start:server

# 开发模式启动（tsx 直接运行 TS 源码）
npm run dev:server

# 运行测试（vitest）
npm test

# 监听模式测试
npm run test:watch
```

### 在 WSL 中调试

本仓库的 `node_modules/.bin` 由 Windows 侧 npm 生成，其中的 shim 是 0 字节文件，
在 WSL 里执行 `npm run build` / `npm test` 会「成功但什么都没做」。**在 WSL 下请使用直接调用入口的脚本：**

```bash
# WSL 中编译（等价于 tsc）
npm run build:node

# WSL 中运行测试（等价于 vitest run）
npm run test:node

# WSL 中启动服务器
npm run start:server
```

多客户端联调与截图辅助脚本位于 [scripts/debug](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/scripts/debug)：

```bash
# 投放 N 个脚本玩家并全部准备，用于触发开局（浏览器端可作为第 3 名玩家加入）
node scripts/debug/drive-players.cjs 2 20000

# 通过 CDP 连接无头浏览器，等待指定游戏状态后截图
node scripts/debug/cdp-shot.cjs shot.png 15000 PLAYING
```

### 界面调试参数

页面支持若干仅用于调试的 URL 参数（不影响正常玩法）：

| 参数 | 作用 |
|------|------|
| `?debug=layout` | 在 DOM 中写入关键元素实测尺寸，便于核验响应式布局 |
| `?debug=state&scene=playing` | 用真实渲染器离线渲染单个对局画面（可选 `waiting` / `countdown` / `playing` / `path` / `danger` / `dead` / `gameover`） |
| `?debug=hud&phase=playing` | 用真实状态栏渲染器输出指定阶段的状态栏（可选 `idle` / `playing` / `finished`） |
| `?debug=perf&frames=180` | 连续绘制对局画面并统计单帧耗时（结果写入 `#perfProbe`），用于核验帧率余量 |
| `?autoplay=1` | 加入房间后自动准备，便于无头环境验证进行中界面 |
| `?server=<host>` | 指定 WebSocket 服务器地址 |

当前实测（无头 Edge、1280×720、24 个障碍物、180 帧同步绘制）：

```
avg 0.102ms / median 0.100ms / p95 0.200ms / max 4ms（首帧建渐变）   60fps 预算 16.67ms
```

即单帧绘制只占 60fps 预算的约 0.6%，**帧率瓶颈不在绘制，而在服务端 20Hz 的状态广播**，因此平滑方案放在客户端推帧上。

### 本地访问

`npm run start:server` 后访问 `http://localhost:8000`，服务器会：

- 对 `/` 与 `/index.html` 返回 [public/index.html](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/public/index.html)
- 对 `/dist/*` 返回编译后的客户端脚本
- 同一端口提供 WebSocket 服务

多人测试时用多个浏览器窗口（或标签页）打开同一地址即可自动匹配进同一房间。

### 部署说明

1. **开发环境**：页面通过 `ws://<host>:8000` 直连 Node 服务器
2. **生产环境**：建议用反向代理提供 HTTPS，客户端在 `https:` 下会自动改用 `wss://`（不再附带端口）
3. **指定服务器**：可通过 URL 参数覆盖连接地址，如 `?server=192.168.1.100`
4. **端口**：默认 8000，可通过环境变量 `PORT` 修改

## 测试

使用 Vitest，当前测试覆盖两个核心模块：

- [collision-detector.test.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/server/collision-detector.test.ts) - 同色同路线碰撞、异色不碰撞、异路线不碰撞、死亡玩家不参与判定、位置不重叠等 7 个用例
- [input-merger.test.ts](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/src/client/input-merger.test.ts) - 键盘/触控输入处理、OR 合并、变化时才发送、状态重置与调试信息

此外根目录的 [verify-input-merger.js](file:///d:/Code%20Files/VibeCodingProjects/blind-line-game/verify-input-merger.js) 是一个可在 Node 中直接运行的输入合并逻辑验证脚本（自带简化的 Mock 实现）。

## 代码规范与架构原则

### TypeScript 风格

- 严格类型检查（`strict: true`）
- 接口、类型与核心结构均有中文注释说明
- 语义清晰的命名；类型/接口 PascalCase，变量/函数 camelCase，常量 UPPER_SNAKE_CASE

### 架构原则

- **服务器权威**：世界状态与全部规则判定在服务端
- **客户端只读**：客户端只发送输入，不修改游戏状态、不做碰撞判定
- **渲染与逻辑分离**：渲染层只读取投影后的可见数据
- **可复现性**：障碍物由种子随机数（Mulberry32）生成，随机参数集中管理
- **模块分离**：共享协议、服务端逻辑、客户端渲染/输入/网络各自独立

## 已知实现细节与遗留项

以下为阅读源码时发现的、与文档/命名不完全一致之处，当前行为以代码为准：

- **阻塞性问题（未修复）**：房间开局后服务器会因 `ObstacleGenerator not initialized. Call init() first.` 崩溃（`game-loop.ts` 的 `tick()` → `obstacleGenerator.generateNext()`）。原因是 `GameLoop` 只持有单个 `ObstacleGenerator` 实例且按房间复用，而 `RoomManager.startGame()` 与 `GameLoop.start()` 各自维护一套房间状态，第二轮开局时生成器未针对该房间重新初始化。这属于服务端游戏逻辑缺陷，本次 UI 重构未改动相关代码，另行修复
- `shared/types.ts` 中的 `COLOR_VISIBILITY` 常量（红/绿/蓝各可见 4 色）**未被任何逻辑使用**，实际规则是排除自身颜色
- `ObstacleColor` 定义了 `CYAN` / `MAGENTA` / `WHITE` 混合色，但生成器只从玩家颜色中取色，因此混合色障碍物当前不会出现
- `GAME_CONFIG.STATE_BROADCAST_RATE = 30` 与实际使用的 `GAME_LOOP_CONFIG.BROADCAST_RATE = 20` 不一致，后者才是生效值
- `INITIAL_SCROLL_SPEED` / `MAX_SCROLL_SPEED` / `SCROLL_ACCELERATION` 未被主循环使用，滚动速度恒为 `WORLD_SPEED = 3`；广播中的 `scrollSpeed` 为固定值 `100`
- `HEARTBEAT_INTERVAL` / `CONNECTION_TIMEOUT` 已定义，但客户端未启动心跳定时器
- 存在两套并行的 `GameState` 枚举（`shared/types.ts` 与 `game-loop.ts`，以及 `visibility-filter.ts`），通过转换函数映射
- `input-merger` 中累计的移动次数仅在游戏结束界面展示
- `dist/` 中存在若干历史编译产物（如 `-viewport-manager.js`、`game-tips.js`、`integration-test.js`），源码已无对应文件，删除目录重新编译即可清理

## 许可证

本项目采用 MIT 许可证。

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

---

**注意**：本项目专注于工程实现，遵循既定的游戏设计规则，不进行玩法扩展或优化。
