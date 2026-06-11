#!/usr/bin/env bash
# PRD 성공 기준 검증 스크립트 — dev-cycle/2026_06_11_monorepo-scaffold/prd.md
# 5개 기준 전부 PASS여야 exit 0
set -u
cd "$(dirname "$0")/.."
FAIL=0

check() { # $1=label, $2=exit code
  if [ "$2" -eq 0 ]; then echo "PASS: $1"; else echo "FAIL: $1"; FAIL=1; fi
}

# 기준 4: 순수 pnpm workspace (turbo.json / nx.json 부재)
[ ! -f turbo.json ] && [ ! -f nx.json ]; check "no turbo.json/nx.json" $?

# 전제: 세 workspace 패키지 존재 (pnpm -r 공허한 PASS 방지)
[ -f apps/web/package.json ] && [ -f apps/api/package.json ] && [ -f packages/shared/package.json ]
check "workspace packages exist (web/api/shared)" $?

# 기준 1: pnpm install
pnpm install --frozen-lockfile=false >/tmp/verify-install.log 2>&1
check "pnpm install" $?

# 기준 2: shared 타입 양쪽 import + typecheck
grep -rq "@ai-character/shared" apps/web/src 2>/dev/null; check "web imports @ai-character/shared" $?
grep -rq "@ai-character/shared" apps/api/src 2>/dev/null; check "api imports @ai-character/shared" $?
pnpm -r typecheck >/tmp/verify-typecheck.log 2>&1; check "pnpm -r typecheck" $?

# 기준 5: build
pnpm -r build >/tmp/verify-build.log 2>&1; check "pnpm -r build" $?

# 기준 3: pnpm dev 동시 기동 → :3000 200, :4000/health 200
pnpm dev >/tmp/verify-dev.log 2>&1 &
DEV_PID=$!
WEB_OK=1; API_OK=1
for i in $(seq 1 45); do
  sleep 2
  [ "$WEB_OK" -ne 0 ] && curl -sf -o /dev/null http://localhost:3000 && WEB_OK=0
  [ "$API_OK" -ne 0 ] && curl -sf -o /dev/null http://localhost:4000/health && API_OK=0
  [ "$WEB_OK" -eq 0 ] && [ "$API_OK" -eq 0 ] && break
done
check "web :3000 responds 200" $WEB_OK
check "api :4000/health responds 200" $API_OK
# dev 프로세스 정리 (자식 포함)
pkill -P $DEV_PID 2>/dev/null; kill $DEV_PID 2>/dev/null
pkill -f "next dev" 2>/dev/null; pkill -f "nest start" 2>/dev/null
sleep 1

echo "---"
if [ "$FAIL" -eq 0 ]; then echo "VERDICT: PASS"; else echo "VERDICT: FAIL"; fi
exit $FAIL
