#!/usr/bin/env bash
# control-mode 服务器侧自动部署（拉取式，多源兜底）
#
# 机制：定时从 GitHub 拉 main，commit 变化才构建并发布到 /var/www/control-mode。
# 不依赖 GitHub Actions secrets，也不需要 PAT —— 仓库公开，匿名只读即可。
#
# 为什么要多源：国内服务器直连 github.com 的 HTTPS 会被间歇性中断（TCP 通、TLS 握手被断），
# 实测同一分钟内可通可不通。故按「直连 → 镜像」顺序选第一个能拿到 refs 的源。
#
# 安全边界（刻意收窄）：
#   1. 只写 /opt/control-mode-src 与 /var/www/control-mode，不碰 nginx 与其它站；
#   2. 先构建成功再发布：构建失败直接退出，线上文件保持原样；
#   3. rsync --delete 清掉过期 assets，但排除两个哨兵；
#   4. flock 防并发，手动执行与 cron 不会打架。
set -euo pipefail

REPO_PATH="WisdomHuang2020/control-mode.git"
BRANCH="main"
SOURCES=(
  "https://github.com/$REPO_PATH"
  "https://ghfast.top/https://github.com/$REPO_PATH"
  "https://gh-proxy.com/https://github.com/$REPO_PATH"
  "https://ghproxy.net/https://github.com/$REPO_PATH"
)
SRC="/opt/control-mode-src"
WEB="/var/www/control-mode"
LOCK="/var/lock/control-mode-deploy.lock"
WEB_OWNER="www-data"
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }

exec 9>"$LOCK"
if ! flock -n 9; then
  log "已有部署在进行，跳过本次"
  exit 0
fi

# ── 选源：拿到远端 SHA ────────────────────────────────────────
REMOTE_SHA=""
REMOTE_URL=""
for url in "${SOURCES[@]}"; do
  # 每个源最多等 20s：直连被阻断时握手会挂很久，不设上限会让 cron 堆叠
  sha=$(timeout 20 git ls-remote "$url" "refs/heads/$BRANCH" 2>/dev/null | cut -f1 || true)
  if [ -n "$sha" ]; then
    REMOTE_SHA="$sha"
    REMOTE_URL="$url"
    break
  fi
done
if [ -z "$REMOTE_SHA" ]; then
  log "✘ 所有源都不可达（直连 + 3 个镜像），本次跳过，等下一轮"
  exit 1
fi
REMOTE_HOST=$(printf '%s' "$REMOTE_URL" | sed 's#^https://##; s#/.*##')

LIVE_VER=$(cat "$WEB/.deployed-version" 2>/dev/null | tr -d '\r\n' || true)
# 部署过哪个 commit，单看版本号不够：同一版本可能对应多个 commit（只改脚本不改产物时）
DEPLOYED_SHA=$(cat "$WEB/.deployed-commit" 2>/dev/null | tr -d '\r\n' || true)

# 远端 commit 与「上次部署的 commit」一致，且线上哨兵在 → 静默退出，避免每 5 分钟刷日志
if [ "$REMOTE_SHA" = "$DEPLOYED_SHA" ] && [ -n "$LIVE_VER" ]; then
  exit 0
fi

log "发现更新：${DEPLOYED_SHA:0:7} → ${REMOTE_SHA:0:7}（源 $REMOTE_HOST）"

# ── 取代码 ──────────────────────────────────────────────────
if [ ! -d "$SRC/.git" ]; then
  log "首次克隆 → $SRC"
  # 不删除任何既有目录：改名留档，便于事后排查
  if [ -e "$SRC" ]; then
    mv "$SRC" "${SRC}.stale-$(date +%s)"
    log "已把非 git 目录改名留档：${SRC}.stale-*"
  fi
  git clone --depth 1 --branch "$BRANCH" "$REMOTE_URL" "$SRC"
fi

cd "$SRC"
if ! timeout 180 git fetch --depth 1 "$REMOTE_URL" "$BRANCH" 2>/dev/null; then
  log "浅取失败或被超时打断，改为全量 fetch"
  timeout 300 git fetch "$REMOTE_URL" "$BRANCH"
fi
git reset --hard FETCH_HEAD

# 自检：仓库里的脚本若与已安装版本不同，只提示不自动替换（自动替换一旦写入坏版本会连 cron 一起挂掉）
if [ -f deploy/server-pull-deploy.sh ] && ! cmp -s deploy/server-pull-deploy.sh /usr/local/bin/control-mode-deploy.sh; then
  log "⚠ 仓库中的部署脚本已变更，需手动重装：install -m 755 $SRC/deploy/server-pull-deploy.sh /usr/local/bin/control-mode-deploy.sh"
fi

ART_VER=$(node -p "require('./package.json').version")
log "产物版本 $ART_VER（线上 ${LIVE_VER:-无记录}）"

# ── 依赖：lock 未变就跳过，避免每次全量重装 ─────────────────
LOCK_HASH=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ -d node_modules ] && [ -f .lock-hash ] && [ "$(cat .lock-hash)" = "$LOCK_HASH" ]; then
  log "依赖未变化，跳过 npm ci"
else
  log "安装依赖（npm ci）…"
  npm ci --no-audit --no-fund 2>&1 | tail -6
  printf '%s\n' "$LOCK_HASH" > .lock-hash
fi

# ── 构建：失败即止，绝不发布半成品 ──────────────────────────
log "构建…"
BUILD_LOG=$(mktemp)
if ! npm run build >"$BUILD_LOG" 2>&1; then
  log "✘ 构建失败，线上保持原样（${LIVE_VER:-无记录}）"
  tail -25 "$BUILD_LOG"
  rm -f "$BUILD_LOG"
  exit 1
fi
tail -3 "$BUILD_LOG"
rm -f "$BUILD_LOG"

if [ ! -f dist/index.html ]; then
  log "✘ 构建产物缺少 dist/index.html，放弃发布"
  exit 1
fi

# ── 原子发布 ────────────────────────────────────────────────
log "发布到 $WEB …"
rsync -a --delete --exclude='.deployed-version' --exclude='.deployed-commit' dist/ "$WEB"/
chown -R "$WEB_OWNER:$WEB_OWNER" "$WEB"
printf '%s\n' "$ART_VER" > "$WEB/.deployed-version"
printf '%s\n' "$REMOTE_SHA" > "$WEB/.deployed-commit"

log "✔ 完成：v$ART_VER（commit ${REMOTE_SHA:0:7}）"
