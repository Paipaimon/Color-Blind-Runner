#!/usr/bin/env bash
# 调试辅助脚本（不参与构建与游戏运行）
# 在 WSL 中启动游戏服务器，并把日志同时写入文件，便于宿主侧核验连接与房间分配。
# 用法：bash scripts/debug/run-server.sh [端口]
set -u
cd "$(dirname "$0")/../.." || exit 1

PORT="${1:-8000}"
LOG=".markdown-collab/server.log"
: > "$LOG"

echo "server log -> $LOG"
PORT="$PORT" node dist/server/index.js 2>&1 | tee -a "$LOG"
