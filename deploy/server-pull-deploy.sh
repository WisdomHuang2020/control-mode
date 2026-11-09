#!/usr/bin/env bash
# control-mode 服务器侧自动部署（拉取式）
#
# 机制：定时从 GitHub 拉 main，commit 变化才构建并发布到 /var/www/control-mode。
# 不依赖 GitHub Actions secrets，也不需要 PAT —— 仓库公开，HTTPS 匿名只读即可。
#
# 安全边界（刻意收窄）：
#   1. 只写 /opt/control-mode-src 与 /var/www/control-mode，不碰 nginx 与其它站；
#   2. 先构建成功再发布：构建失败直接退出，线上文件保持原样；
#   3. rsync --delete 会清掉过期 assets，但排除 .deployed-version 哨兵；
#   4. flock 防并发，手动执行与 cron 不会打架。
set -euo pipefail

REPO="https://github.com/WisdomHuang2020/control-mode.git"
BRANCH="main"
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

# ── 首次准备 ────────────────────────────────────────────────
if [ ! -d "$SRC/.git" ]; then
  log "首次克隆 $REPO → $SRC"
  # 不删除任何既有目录：改名留档，便于事后排查
  if [ -e "$SRC" ]; then
    mv "$SRC" "${SRC}.stale-$(date +%s)"
    log "已把非 git 目录改名留档：${SRC}.stale-*"
  fi
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$SRC"
fi

cd "$SRC"

REMOTE_SHA=$(git ls-remote "$REPO" "refs/heads/$BRANCH" 2>/dev/null | cut -f1 || true)
if [ -z "$REMOTE_SHA" ]; then
  log "✘ 读不到远端 SHA（网络或仓库不可达），保持现状"
  exit 1
fi
LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null || echo none)
LIVE_VER=$(cat "$WEB/.deployed-version" 2>/dev/null | tr -d '\r\n' || true)
# 部署过哪个 commit，单看版本号不够：同一版本可能对应多个 commit（只改脚本不改产物时）
DEPLOYED_SHA=$(cat "$WEB/.deployed-commit" 2>/dev/null | tr -d '\r\n' || true)

# 远端 commit 与「上次部署的 commit」一致，且线上哨兵在 → 静默退出，避免每 5 分钟刷日志
if [ "$REMOTE_SHA" = "$DEPLOYED_SHA" ] && [ -n "$LIVE_VER" ]; then
  exit 0
fi

log "发现更新：${LOCAL_SHA:0:7} → ${REMOTE_SHA:0:7}"
git fetch --depth 1 origin "$BRANCH"
git reset --hard "$REMOTE_SHA"

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
