#!/usr/bin/env bash

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
(
  cd "$REPOSITORY_ROOT"
  node --experimental-strip-types packages/headlamp-source/scripts/update-source.ts --prepare --root .
)

NPM_TOOL_DIR="${RUNNER_TEMP:-${AGENT_TEMPDIRECTORY:-${TMPDIR:-/tmp}}}/npm-12"
npm install --prefix "$NPM_TOOL_DIR" --no-save --ignore-scripts --no-audit --no-fund npm@12.0.2

NPM_BIN_DIR="$NPM_TOOL_DIR/node_modules/.bin"
export PATH="$NPM_BIN_DIR:$PATH"

if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "$NPM_BIN_DIR" >> "$GITHUB_PATH"
fi
if [[ -n "${AGENT_TEMPDIRECTORY:-}" ]]; then
  echo "##vso[task.prependpath]$NPM_BIN_DIR"
fi

npm --version
