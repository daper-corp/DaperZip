#!/usr/bin/env bash
# Maintainers only: replace the bundled 7-Zip in vendor/7zip/ with another
# official release, then commit the result. Normal builds need no network.
#
#   scripts/update-7zip.sh 2604        # 7-Zip 26.04
#
# Needs curl, tar (with xz) and an existing 7-Zip (7z/7zz) to unpack the
# Windows installer.
set -euo pipefail
VERSION="${1:?usage: $0 <version, e.g. 2604>}"
BASE="https://www.7-zip.org/a"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/vendor/7zip"
SZ="$(command -v 7zz || command -v 7z || command -v 7z.exe || true)"
[ -n "$SZ" ] || { echo "need an installed 7-Zip to unpack the Windows installer" >&2; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$BASE/7z$VERSION-x64.exe" -o "$TMP/win.exe"
curl -fsSL "$BASE/7z$VERSION-mac.tar.xz" -o "$TMP/mac.tar.xz"
curl -fsSL "$BASE/7z$VERSION-linux-x64.tar.xz" -o "$TMP/linux.tar.xz"
mkdir -p "$TMP/win" "$TMP/mac" "$TMP/linux"
"$SZ" x "$TMP/win.exe" -o"$TMP/win" -y >/dev/null
tar -xJf "$TMP/mac.tar.xz" -C "$TMP/mac"
tar -xJf "$TMP/linux.tar.xz" -C "$TMP/linux"

mkdir -p "$OUT/windows-x64" "$OUT/macos" "$OUT/linux-x64"
cp "$TMP/win/7z.exe" "$TMP/win/7z.dll" "$OUT/windows-x64/"
cp "$TMP/mac/7zz" "$OUT/macos/7zz"
cp "$TMP/linux/7zzs" "$OUT/linux-x64/7zz" # static build: runs on any distro
chmod +x "$OUT/macos/7zz" "$OUT/linux-x64/7zz"
cp "$TMP/win/License.txt" "$OUT/License.txt"
cp "$TMP/win/readme.txt" "$OUT/readme.txt"
echo "${VERSION:0:2}.${VERSION:2}" > "$OUT/VERSION"
if command -v sha256sum >/dev/null; then H="sha256sum"; else H="shasum -a 256"; fi
(cd "$OUT" && $H windows-x64/7z.exe windows-x64/7z.dll macos/7zz linux-x64/7zz License.txt > SHA256SUMS)
echo "Updated vendor/7zip to 7-Zip $(cat "$OUT/VERSION")"
cat "$OUT/SHA256SUMS"
