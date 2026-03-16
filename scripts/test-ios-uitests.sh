#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/test-ios-uitests.sh
#
# Runs the iOS UI test suite (SOMIHomeUITests) against a local backend.
# The backend is started automatically with an embedded in-memory MongoDB —
# no separate database setup required.
#
# Prerequisites
#   - Node 20+, npm ci already run at repo root
#   - Xcode installed (Xcode 15+ for iOS 17 simulator)
#   - xcpretty recommended (nicer output): gem install xcpretty
#
# Usage
#   ./scripts/test-ios-uitests.sh
#   ./scripts/test-ios-uitests.sh --simulator "iPhone 15"
#
# Environment variables (all optional)
#   SIMULATOR   iOS Simulator name  (default: "iPhone 16")
#   RESULTS_PATH  xcresult output path (default: /tmp/ios-uitest-results.xcresult)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SIMULATOR="${SIMULATOR:-iPhone 16}"
RESULTS_PATH="${RESULTS_PATH:-/tmp/ios-uitest-results.xcresult}"
PROJECT="apps/somi-home-ios/SOMIHome.xcodeproj"
SCHEME="SOMIHome"

# ── Parse CLI args ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --simulator) SIMULATOR="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ── Resolve repo root so the script works from any directory ─────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ── Start backend with embedded MongoDB ──────────────────────────────────────
echo "▶ Starting backend (embedded MongoDB)..."
npm run start:e2e -w somi-connect &
BACKEND_PID=$!

cleanup() {
  echo "▶ Stopping backend (PID $BACKEND_PID)..."
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Wait for backend to become ready ─────────────────────────────────────────
echo "▶ Waiting for backend on http://localhost:3000/healthz ..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/healthz > /dev/null 2>&1; then
    echo "▶ Backend ready (${i}s)."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "✗ Backend did not become ready within 30 seconds." >&2
    exit 1
  fi
  sleep 1
done

# ── Run iOS UI tests ──────────────────────────────────────────────────────────
echo "▶ Running iOS UI tests (simulator: $SIMULATOR)..."
rm -rf "$RESULTS_PATH"

XCODEBUILD=(
  xcodebuild test
  -project "$PROJECT"
  -scheme "$SCHEME"
  -destination "platform=iOS Simulator,name=$SIMULATOR,OS=latest"
  -only-testing SOMIHomeUITests
  -resultBundlePath "$RESULTS_PATH"
)

if command -v xcpretty &>/dev/null; then
  set -o pipefail
  "${XCODEBUILD[@]}" | xcpretty
else
  "${XCODEBUILD[@]}"
fi

echo ""
echo "✓ iOS UI tests passed."
echo "  Results bundle: $RESULTS_PATH"
