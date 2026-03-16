#!/usr/bin/env bash
# pre-push hook — run all fast tests before any push reaches GitHub.
# Install once with:  scripts/install-hooks.sh
#
# Skips mobile tests by default (slow). Pass --with-mobile to include them.
#   git push                  # backend + frontend only
#   SOMI_TEST_MOBILE=1 git push  # also runs iOS + Android

set -euo pipefail

WITH_MOBILE="${SOMI_TEST_MOBILE:-0}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo ""
echo "==> pre-push: running local tests before push"
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
echo "--- somi-connect: lint + typecheck + test + build ---"
npm run lint      -w somi-connect
npm run typecheck -w somi-connect
npm run test      -w somi-connect
npm run build     -w somi-connect
echo ""

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "--- somi-clinic-web: lint + typecheck + test + build ---"
npm run lint      -w somi-clinic-web
npm run typecheck -w somi-clinic-web
npm run test      -w somi-clinic-web
npm run build     -w somi-clinic-web
echo ""

# ── Mobile (opt-in) ───────────────────────────────────────────────────────────
if [ "$WITH_MOBILE" = "1" ]; then
  echo "--- iOS unit + UI tests ---"
  scripts/test-ios-uitests.sh
  echo ""

  echo "--- Android unit tests ---"
  cd apps/somi-home-android
  ./gradlew :app:test --no-daemon
  cd "$REPO_ROOT"
  echo ""
fi

echo "==> pre-push: all checks passed"
echo ""
