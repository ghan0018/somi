#!/usr/bin/env bash
# Install git hooks for this repo.
# Run once after cloning: scripts/install-hooks.sh

set -euo pipefail

HOOKS_DIR="$(git rev-parse --git-common-dir)/hooks"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cp "$REPO_ROOT/scripts/pre-push.sh" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"

echo "Installed pre-push hook."
echo "  Every 'git push' will run backend + frontend tests locally."
echo "  To also run iOS/Android: SOMI_TEST_MOBILE=1 git push"
