#!/usr/bin/env bash
# 手动首部署（与 .github/workflows/deploy-lighthouse.yml 同构，供本机在 CI secrets 配好之前使用）。
#
# 用法（先 npm run build）：
#   LH_HOST=43.142.148.37 LH_ROOT=/var/www/control-mode \
#   LH_SSH_KEY_PATH=~/.ssh/control_mode_ci bash deploy/deploy.sh
#
# 只写 LH_ROOT 指定的这一个目录，绝不触碰 /etc/nginx 或其它站的 web 根。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LH_HOST="${LH_HOST:?必须设置 LH_HOST}"
LH_USER="${LH_USER:-root}"
LH_ROOT="${LH_ROOT:?必须设置 LH_ROOT}"
LH_SSH_KEY_PATH="${LH_SSH_KEY_PATH:?必须设置 LH_SSH_KEY_PATH}"
LH_PORT="${LH_PORT:-22}"
DOMAIN="www.control-mode.power-knowledge.tech"
WEB_OWNER="www-data"

[ -f "$ROOT/dist/index.html" ] || { echo "缺少 dist/index.html，请先 npm run build"; exit 1; }
[ -f "$LH_SSH_KEY_PATH" ] || { echo "部署私钥不存在：$LH_SSH_KEY_PATH"; exit 1; }

# 用 cwd + 相对路径读版本：Git Bash 下 /c/Users/... 传给 Windows 原生 node 会解析失败。
ART_VER=$(cd "$ROOT" && node -p "require('./package.json').version")
SSH_CMD="ssh -p $LH_PORT -i $LH_SSH_KEY_PATH -o BatchMode=yes -o ConnectTimeout=20 $LH_USER@$LH_HOST"

echo "==> 目标：$LH_USER@$LH_HOST:$LH_ROOT，产物版本 $ART_VER"
$SSH_CMD "whoami; hostname; ls -ld '$LH_ROOT'"

# 降级护栏
LIVE_VER=$($SSH_CMD "cat '$LH_ROOT/.deployed-version' 2>/dev/null || true" | tr -d '\r\n' | head -c 64)
echo "==> 线上已部署版本：${LIVE_VER:-（无记录）}"
if [ -n "$LIVE_VER" ] && [ "$LIVE_VER" != "$ART_VER" ]; then
  OLDEST=$(printf '%s\n%s\n' "$LIVE_VER" "$ART_VER" | sort -V | head -1)
  if [ "$OLDEST" = "$ART_VER" ]; then
    echo "拒绝降级部署：$ART_VER 严格早于线上 $LIVE_VER"; exit 1
  fi
fi

# 备份（失败不阻断）
$SSH_CMD "tar czf ~/control-mode-backup-\$(date +%F-%H%M%S).tar.gz -C '$LH_ROOT' . 2>/dev/null || true"

# tar over ssh，不做删除
echo "==> 上传产物"
tar czf - -C "$ROOT/dist" . | $SSH_CMD "tar xzf - --no-same-owner -C '$LH_ROOT'"
$SSH_CMD "chown -R $WEB_OWNER:$WEB_OWNER '$LH_ROOT'" || true

# 版本哨兵（格式：三段式、不带 v 前缀，入口站 useLiveVersions.ts 会读它）
$SSH_CMD "printf '%s\n' '$ART_VER' > '$LH_ROOT/.deployed-version'"
echo "==> 哨兵已写入：$LH_ROOT/.deployed-version = $ART_VER"

# ── 三层核验（本机视角；失败只告警，不回滚）─────────────────────────
set +e
echo "==> 第一层：状态码"
for u in "https://$DOMAIN/" "https://control-mode.power-knowledge.tech/"; do
  printf '  %-55s ' "$u"
  curl -sS -o /dev/null -w 'http=%{http_code} redirect=%{redirect_url}\n' -m 20 "$u" 2>&1
done

echo "==> 第二层：产物指纹"
LIVE_HTML=$(curl -sS -m 20 "https://$DOMAIN/" 2>/dev/null)
LOCAL_JS=$(basename "$(ls "$ROOT"/dist/assets/index-*.js | head -1)")
printf '  本地入口 JS: %s\n' "$LOCAL_JS"
if printf '%s' "$LIVE_HTML" | grep -q "$LOCAL_JS"; then
  echo "  ✔ 线上入口 JS 与本次构建一致"
else
  echo "  ⚠ 线上 HTML 未匹配到本次入口 JS（可能 DNS 未生效 / 缓存 / 部署未生效），请用 --resolve 复核"
fi

echo "==> 第三层：渲染（版本号与关键文案）"
printf '%s' "$LIVE_HTML" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "  ⚠ HTML 中未见版本号（SPA 由 JS 注入，属正常，需无头浏览器核验）"
echo "  提示：SPA 的版本号由 JS 注入到 .app-version，需无头浏览器渲染后断言才算完成第三层。"
exit 0
