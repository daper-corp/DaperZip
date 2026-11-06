#!/bin/sh
# DaperZip terminal installer for macOS and Linux.
# Files are verified against the release's SHA256SUMS before installing.
set -eu

REPO="daper-corp/DaperZip"
BASE="https://github.com/$REPO/releases/download"

usage() {
  cat <<'EOF'
DaperZip installer (macOS / Linux)

  curl -fsSL https://zip.dapercorp.com/install.sh | sh

Options:
  --no-quarantine   macOS: also remove the Gatekeeper quarantine flag.
  -h, --help        Show this help.

Downloads made with curl carry no macOS quarantine flag, so the app normally
launches without a Gatekeeper warning. Use --no-quarantine only if macOS still
blocks it (for example after a browser download).
EOF
}

NO_QUARANTINE=0
for arg in "$@"; do
  case "$arg" in
    --no-quarantine) NO_QUARANTINE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: required command not found: $1" >&2
    exit 1
  }
}

need curl
need uname

os=$(uname -s)
tmp=$(mktemp -d 2>/dev/null || mktemp -d -t daperzip)
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT INT TERM

version=$(curl -fsSL "https://api.github.com/repos/$REPO/releases?per_page=1" \
  | grep -o '"tag_name": *"[^"]*"' \
  | head -n 1 \
  | sed 's/.*"\(v[^"]*\)"/\1/')

if [ -z "$version" ]; then
  echo "error: could not determine the latest release" >&2
  exit 1
fi
num=${version#v}

verify() {
  file=$1
  curl -fsSL "$BASE/$version/SHA256SUMS" -o "$tmp/SHA256SUMS"
  line=$(grep "  $file\$" "$tmp/SHA256SUMS" || true)
  if [ -z "$line" ]; then
    echo "error: $file is not listed in SHA256SUMS" >&2
    exit 1
  fi
  ( cd "$tmp" && if command -v sha256sum >/dev/null 2>&1; then
      printf '%s\n' "$line" | sha256sum -c -
    else
      printf '%s\n' "$line" | shasum -a 256 -c -
    fi )
}

case "$os" in
  Darwin)
    need hdiutil
    file="DaperZip_${num}_universal.dmg"
    echo "Downloading $file ..."
    curl -fL "$BASE/$version/$file" -o "$tmp/$file"
    verify "$file"

    mnt="$tmp/mnt"
    mkdir -p "$mnt"
    hdiutil attach "$tmp/$file" -nobrowse -quiet -mountpoint "$mnt"
    dest="/Applications"
    if [ ! -w "$dest" ]; then
      dest="$HOME/Applications"
      mkdir -p "$dest"
    fi
    rm -rf "$dest/DaperZip.app"
    cp -R "$mnt/DaperZip.app" "$dest/DaperZip.app"
    hdiutil detach "$mnt" -quiet || true

    if [ "$NO_QUARANTINE" = "1" ]; then
      xattr -dr com.apple.quarantine "$dest/DaperZip.app" 2>/dev/null || true
      echo "Removed the quarantine flag from $dest/DaperZip.app"
    else
      echo "If macOS still blocks the first launch: System Settings -> Privacy & Security -> Open Anyway."
    fi
    echo "Installed $dest/DaperZip.app"
    ;;

  Linux)
    case "$(uname -m)" in
      x86_64|amd64) ;;
      *) echo "error: only x86_64 Linux builds are published" >&2; exit 1 ;;
    esac

    if command -v apt-get >/dev/null 2>&1; then
      file="DaperZip_${num}_amd64.deb"
      echo "Downloading $file ..."
      curl -fL "$BASE/$version/$file" -o "$tmp/$file"
      verify "$file"
      sudo apt-get install -y "$tmp/$file"
    else
      need chmod
      file="DaperZip_${num}_amd64.AppImage"
      echo "Downloading $file ..."
      curl -fL "$BASE/$version/$file" -o "$tmp/$file"
      verify "$file"
      mkdir -p "$HOME/.local/bin"
      cp "$tmp/$file" "$HOME/.local/bin/DaperZip.AppImage"
      chmod +x "$HOME/.local/bin/DaperZip.AppImage"
      echo "Installed $HOME/.local/bin/DaperZip.AppImage"
      echo "Run it directly, or add \$HOME/.local/bin to your PATH."
    fi
    ;;

  *)
    echo "error: unsupported OS: $os (use winget on Windows)" >&2
    exit 1
    ;;
esac
