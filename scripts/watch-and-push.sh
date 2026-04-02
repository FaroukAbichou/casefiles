#!/usr/bin/env bash
# Batch file changes, then commit + push. Requires: brew install fswatch
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v fswatch >/dev/null 2>&1; then
  echo "Install fswatch first: brew install fswatch"
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repository."
  exit 1
fi

echo "Watching portfolio-content, dashboard/src, dashboard/server, and package files…"
echo "Latency 2s batches events. Ctrl+C to stop."
echo ""

# -l 2: wait 2s after last change before firing (debounce)
# -o: one line per batch of changes
fswatch -l 2 -o \
  "$ROOT/portfolio-content" \
  "$ROOT/dashboard/src" \
  "$ROOT/dashboard/server" \
  "$ROOT/package.json" \
  "$ROOT/dashboard/package.json" \
  "$ROOT/dashboard/vite.config.ts" \
  "$ROOT/dashboard/tsconfig.json" \
  "$ROOT/dashboard/components.json" \
| while read -r _; do
  git add -A
  if git diff --cached --quiet; then
    continue
  fi
  msg="chore: sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if ! git commit -m "$msg"; then
    echo "Commit failed (hooks, identity, etc.). Fix and save again."
    continue
  fi
  git push || echo "Push failed (offline or auth). Run: git push"
done
