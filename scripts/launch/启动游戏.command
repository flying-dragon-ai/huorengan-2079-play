#!/bin/zsh
# 双击启动《活人感 2079》：本机起一个只对自己开放的小服务器，再用 Chrome 全屏打开
cd "$(dirname "$0")/../.."
PORT=2079
if ! command -v node >/dev/null 2>&1; then
  echo "没找到 Node.js。请先装 Node.js 20.19 或更新版本：https://nodejs.org/"
  read -r "?按回车关闭"
  exit 1
fi
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  # nohup 加 &!：这个终端窗口关掉以后，服务器还在
  nohup node scripts/serve.mjs </dev/null >/dev/null 2>>.server.log &!
  for i in {1..20}; do lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 && break; sleep 0.25; done
fi
URL="http://127.0.0.1:$PORT/index.html$1"
open -na "Google Chrome" --args --app="$URL" --start-fullscreen --autoplay-policy=no-user-gesture-required
echo "游戏已打开：$URL"
echo "关掉游戏窗口：Cmd+W"
echo "录演示视频：./scripts/launch/启动游戏.command '?auto=1' ，再点一下画面"
