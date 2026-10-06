#!/bin/bash
# Cloud sessions start from a fresh clone: install deps so typecheck/build work right away.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR/app"
bun install --frozen-lockfile
