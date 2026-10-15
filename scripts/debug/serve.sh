#!/usr/bin/env bash
# 启动/重启本地游戏服务器（调试辅助，不参与构建与游戏运行）
#
# 用法（在 WSL 中执行）：
#   bash scripts/debug/serve.sh          # 若未运行则后台启动
#   bash scripts/debug/serve.sh restart  # 强制重启
#
# 说明：服务器监听 0.0.0.0:8000，因此 WSL 内、Windows（经 WSL IP）与同局域网手机
#       都可访问。Windows 侧若要直接用 localhost，需要 WSL 的 localhost 转发生效
#       （见仓库根目录说明：%USERPROFILE%\.wslconfig 中 localhostForwarding=true）。
set -u
cd "$(dirname "$0")/../.." || exit 1

PORT="${PORT:-8000}"
ACTION="${1:-start}"
LOG=".markdown-collab/server.log"

is_up() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:${PORT}/" 2>/dev/null | grep -q '^200$'
}

if [ "$ACTION" = "restart" ] || [ "$ACTION" = "stop" ] || ! is_up; then
  pkill -f 'dist/server/index.js' >/dev/null 2>&1 || true
  sleep 1
fi

if [ "$ACTION" = "stop" ]; then
  echo "server stopped"
  exit 0
fi

if is_up; then
  echo "server already running on :${PORT}"
else
  : > "$LOG"
  nohup node dist/server/index.js >> "$LOG" 2>&1 &
  echo "server starting (log: ${LOG})"
  for _ in $(seq 1 30); do
    sleep 0.5
    if is_up; then break; fi
  done
fi

if is_up; then
  echo "listen: OK (0.0.0.0:${PORT})"
  echo "WSL IP: $(hostname -I | awk '{print $1}')"
  echo "lan url: http://$(hostname -I | awk '{print $1}'):${PORT}/"
else
  echo "FAIL: server not ready, see ${LOG}"
  exit 1
fi
