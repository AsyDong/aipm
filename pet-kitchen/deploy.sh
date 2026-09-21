#!/bin/bash
# ============ pet-kitchen 一键部署 ============
# 用法：./deploy.sh
# 做四件事：构建前端 → 清理并同步静态资源 → 打包后端 → 重启服务
#
# 部署策略（2026-09-19 定稿）：
#   · index.html 由 nginx 发 Cache-Control: no-cache —— 浏览器每次打开页面都
#     回源验证（ETag 304 或拉新），天然自动更新到最新版；
#   · /assets/* 带 hash 指纹且发 immutable 一年缓存 —— 内容永不变化；
#   · 因此部署可以放心删光旧资源：刚拿到新 index.html 的浏览器引用的
#     一定是新 hash 文件，旧资源没人需要。

set -e
cd "$(dirname "$0")"

echo "[1/4] 构建前端（tsc + vite build）..."
npm run build

echo "[2/4] 清理并同步静态资源到 nginx root..."
rm -rf /opt/pet-checkin/dist
mkdir -p /opt/pet-checkin/dist
cp -r dist/* /opt/pet-checkin/dist/

echo "[3/4] 打包后端（esbuild，零依赖单文件）..."
npx esbuild server/server.ts --bundle --platform=node --format=cjs \
  --outfile=server/server.build.cjs --log-level=error
cp server/server.build.cjs /opt/pet-checkin/server.cjs

echo "[4/4] 重启后端服务..."
systemctl restart pet-checkin
sleep 2

# 部署自检
echo "--- 自检 ---"
curl -s http://127.0.0.1:8787/health
echo
BUNDLE=$(ls -t /opt/pet-checkin/dist/assets/index-*.js | head -1 | xargs basename)
LIVE=$(curl -sk https://127.0.0.1/ -H "Host: petkitchen.online" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
echo "磁盘最新 bundle: $BUNDLE"
echo "线上 index.html 引用: $LIVE"
[ "$BUNDLE" = "$LIVE" ] && echo "✅ 部署成功" || echo "❌ 线上还是旧版本，检查 nginx root 指向"
