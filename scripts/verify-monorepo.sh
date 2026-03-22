#!/bin/bash
# Monorepo structure verification for SPEC-MOBILE-001
# RED phase: This script defines what success looks like
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local path="$2"
  if [ -f "$path" ] || [ -d "$path" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc: $path not found"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Verifying Monorepo Structure ==="

echo ""
echo "--- Phase 1: Monorepo Config Files ---"
check "pnpm-workspace.yaml exists" "$ROOT/pnpm-workspace.yaml"
check "turbo.json exists" "$ROOT/turbo.json"

echo ""
echo "--- Phase 2: packages/shared ---"
check "packages/shared/package.json" "$ROOT/packages/shared/package.json"
check "packages/shared/tsconfig.json" "$ROOT/packages/shared/tsconfig.json"
check "packages/shared/src/index.ts" "$ROOT/packages/shared/src/index.ts"
check "packages/shared/src/types/index.ts" "$ROOT/packages/shared/src/types/index.ts"
check "packages/shared/src/lib/utils.ts" "$ROOT/packages/shared/src/lib/utils.ts"
check "packages/shared/src/lib/transcript-parser.ts" "$ROOT/packages/shared/src/lib/transcript-parser.ts"
check "packages/shared/src/lib/supabase-store.ts" "$ROOT/packages/shared/src/lib/supabase-store.ts"
check "packages/shared/src/store/app-store.ts" "$ROOT/packages/shared/src/store/app-store.ts"
check "packages/shared/src/store/study-store.ts" "$ROOT/packages/shared/src/store/study-store.ts"

echo ""
echo "--- Phase 3: apps/web ---"
check "apps/web/package.json" "$ROOT/apps/web/package.json"
check "apps/web/tsconfig.json" "$ROOT/apps/web/tsconfig.json"

echo ""
echo "--- Phase 4: apps/mobile ---"
check "apps/mobile/package.json" "$ROOT/apps/mobile/package.json"

echo ""
echo "--- Content Verification ---"
# Check @inputenglish/shared name in package.json
if grep -q '"name": "@inputenglish/shared"' "$ROOT/packages/shared/package.json" 2>/dev/null; then
  echo "  [PASS] packages/shared has correct package name"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] packages/shared missing correct package name"
  FAIL=$((FAIL + 1))
fi

# Check factory pattern in supabase-store.ts
if grep -q 'createSupabaseStore' "$ROOT/packages/shared/src/lib/supabase-store.ts" 2>/dev/null; then
  echo "  [PASS] supabase-store.ts uses factory pattern (createSupabaseStore)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] supabase-store.ts missing factory pattern"
  FAIL=$((FAIL + 1))
fi

# Check no @/ imports in shared package
if grep -rq '@/' "$ROOT/packages/shared/src/" 2>/dev/null; then
  echo "  [FAIL] packages/shared contains @/ absolute imports (must use relative)"
  FAIL=$((FAIL + 1))
else
  echo "  [PASS] packages/shared has no @/ absolute imports"
  PASS=$((PASS + 1))
fi

# Check factory pattern in app-store.ts
if grep -q 'createAppStore' "$ROOT/packages/shared/src/store/app-store.ts" 2>/dev/null; then
  echo "  [PASS] app-store.ts uses factory pattern (createAppStore)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] app-store.ts missing factory pattern"
  FAIL=$((FAIL + 1))
fi

# Check factory pattern in study-store.ts
if grep -q 'createStudyStore' "$ROOT/packages/shared/src/store/study-store.ts" 2>/dev/null; then
  echo "  [PASS] study-store.ts uses factory pattern (createStudyStore)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] study-store.ts missing factory pattern"
  FAIL=$((FAIL + 1))
fi

# Check workspace dependency in apps/mobile
if grep -q '"@inputenglish/shared": "workspace:\*"' "$ROOT/apps/mobile/package.json" 2>/dev/null; then
  echo "  [PASS] apps/mobile depends on @inputenglish/shared workspace"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] apps/mobile missing @inputenglish/shared workspace dependency"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ $FAIL -eq 0 ]; then
  echo "SUCCESS: All checks passed!"
  exit 0
else
  echo "FAILURE: $FAIL checks failed"
  exit 1
fi
