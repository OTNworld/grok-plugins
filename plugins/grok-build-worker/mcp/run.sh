#!/bin/sh
# First start: install lockfile deps into mcp/node_modules. No extra URLs.
set -e
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
if [ ! -d "$ROOT/node_modules/@modelcontextprotocol/sdk" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "grok-build-worker: npm not on PATH (need Node.js 18+)" >&2
    exit 1
  fi
  if [ ! -f "$ROOT/package-lock.json" ]; then
    echo "grok-build-worker: missing package-lock.json" >&2
    exit 1
  fi
  (cd "$ROOT" && npm ci --omit=dev)
fi
exec node "$ROOT/server.js"
