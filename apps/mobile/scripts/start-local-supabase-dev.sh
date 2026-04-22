#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/../.." && pwd)"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI가 설치되어 있지 않아요." >&2
  exit 1
fi

STATUS_OUTPUT="$(cd "${REPO_ROOT}" && supabase status 2>/dev/null || true)"

if [[ -z "${STATUS_OUTPUT}" ]] || [[ "${STATUS_OUTPUT}" != *"Project URL"* ]]; then
  echo "로컬 Supabase가 아직 실행 중이 아니에요. 먼저 'supabase start -x studio'를 실행해주세요." >&2
  exit 1
fi

PUBLISHABLE_KEY="$(
  printf '%s\n' "${STATUS_OUTPUT}" \
    | awk -F'│' '/Publishable/ { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3); print $3 }'
)"

if [[ -z "${PUBLISHABLE_KEY}" ]]; then
  echo "로컬 Supabase publishable key를 읽지 못했어요." >&2
  exit 1
fi

HOST_MODE="${SUPABASE_HOST_MODE:-lan}"
SUPABASE_HOST=""

if [[ "${HOST_MODE}" == "localhost" ]]; then
  SUPABASE_HOST="127.0.0.1"
else
  SUPABASE_HOST="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [[ -z "${SUPABASE_HOST}" ]]; then
    SUPABASE_HOST="$(ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [[ -z "${SUPABASE_HOST}" ]]; then
    echo "Mac의 LAN IP를 찾지 못했어요. SUPABASE_HOST_MODE=localhost 로 다시 실행하거나 네트워크를 확인해주세요." >&2
    exit 1
  fi
fi

export EXPO_PUBLIC_SUPABASE_URL="http://${SUPABASE_HOST}:54321"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${PUBLISHABLE_KEY}"

echo "Using local Supabase:"
echo "  EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL}"
echo "  EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY}"
echo ""
echo "참고: 로컬 Supabase에서는 소셜 로그인 설정이 원격과 다를 수 있어요."

cd "${APP_DIR}"
exec expo start --host lan "$@"
