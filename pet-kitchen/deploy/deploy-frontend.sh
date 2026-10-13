#!/usr/bin/env bash
# ============================================================================
# 前端一键部署：本地构建 → 传到服务器 → 原子替换 web 根
#
# 用法（在项目根目录）：
#   bash deploy/deploy-frontend.sh
#
# 需要在环境里准备好（或直接改下面的默认值）：
#   DEPLOY_HOST   服务器地址，如 root@124.222.148.45
#   DEPLOY_ROOT   服务器上的站点根目录，默认 /opt/pet-kitchen
#
# 依赖：ssh / scp（本机）、已配好的 SSH 免密或密码登录。
# 说明：脚本只搬前端静态产物；后端 server.cjs 的更新走另一条链路
#      （见 docs/后端接入说明.md 的 docker run 一节），两者互不影响。
# ============================================================================
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@124.222.148.45}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/pet-kitchen}"
STAMP="$(date +%Y%m%d-%H%M%S)"

cd "$(dirname "$0")/.."

echo "==> 1/4 构建（生产模式，读 .env.production）"
npm run build

if [ ! -f dist/index.html ]; then
  echo "!! 构建产物缺失：dist/index.html 不存在" >&2
  exit 1
fi

echo "==> 2/4 打包"
tar -czf "/tmp/petkitchen-web-${STAMP}.tar.gz" -C dist .

echo "==> 3/4 上传到 ${DEPLOY_HOST}:${DEPLOY_ROOT}"
ssh "$DEPLOY_HOST" "mkdir -p ${DEPLOY_ROOT}/releases ${DEPLOY_ROOT}/web"
scp "/tmp/petkitchen-web-${STAMP}.tar.gz" "${DEPLOY_HOST}:/tmp/"

echo "==> 4/4 服务器端原子替换（解到新目录再切软链，避免半截文件被访问到）"
ssh "$DEPLOY_HOST" bash -s <<REMOTE
set -euo pipefail
mkdir -p ${DEPLOY_ROOT}/releases/${STAMP}
tar -xzf /tmp/petkitchen-web-${STAMP}.tar.gz -C ${DEPLOY_ROOT}/releases/${STAMP}
# web 是指向 releases/<时间戳> 的软链：切换是原子的
ln -sfn ${DEPLOY_ROOT}/releases/${STAMP} ${DEPLOY_ROOT}/web
# 只保留最近 5 个版本
ls -1dt ${DEPLOY_ROOT}/releases/* | tail -n +6 | xargs -r rm -rf
rm -f /tmp/petkitchen-web-${STAMP}.tar.gz
echo "OK -> \$(readlink -f ${DEPLOY_ROOT}/web)"
REMOTE

rm -f "/tmp/petkitchen-web-${STAMP}.tar.gz"
echo "==> 部署完成：https://petkitchen.com/"
