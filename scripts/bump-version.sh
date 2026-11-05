#!/usr/bin/env bash
# Set the app version everywhere it is stored and create a release-notes stub.
#
#   scripts/bump-version.sh 0.1.1
#
# Pushing the result to main releases it automatically once
# release-notes/v<version>.md exists (see .github/workflows/build.yml).
set -euo pipefail
V="${1:?usage: $0 <version, e.g. 0.1.1>}"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "not a version: $V" >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# workspace version (Cargo.toml) and app version (tauri.conf.json)
sed -i.bak -E "0,/^version = \".*\"/s//version = \"$V\"/" Cargo.toml && rm -f Cargo.toml.bak
tmp=$(mktemp)
jq --arg v "$V" '.version = $v' app/tauri.conf.json > "$tmp" && mv "$tmp" app/tauri.conf.json
cargo update -w --offline >/dev/null 2>&1 || cargo update -w >/dev/null
NOTES="release-notes/v$V.md"
if [ ! -f "$NOTES" ]; then
  mkdir -p release-notes
  printf '## 변경 사항\n\n- \n' > "$NOTES"
  echo "Created $NOTES — write the release notes, then commit and push to main."
fi
echo "Version set to $V"
