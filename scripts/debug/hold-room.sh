#!/usr/bin/env bash
# 调试辅助脚本（不参与构建与游戏运行）
# 投放脚本玩家占位并保持在线，用于核验大厅状态栏的在线/已准备人数。
# 用法：bash scripts/debug/hold-room.sh [人数] [保持毫秒]
set -u
cd "$(dirname "$0")/../.." || exit 1

COUNT="${1:-2}"
HOLD_MS="${2:-15000}"

echo "[hold-room] 投放 ${COUNT} 名占位玩家，保持 ${HOLD_MS}ms（不准备）"
node scripts/debug/drive-players.cjs "$COUNT" "$HOLD_MS" -1
