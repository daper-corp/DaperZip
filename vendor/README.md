# vendor/7zip

The official, unmodified **7-Zip 26.04** console program, committed so the app
can be built and used **without an internet connection**.

| Folder | Files | Bundled into |
|---|---|---|
| `windows-x64/` | `7z.exe`, `7z.dll` | Windows installer and portable zip |
| `macos/` | `7zz` (universal: Apple Silicon + Intel) | macOS `.app` / `.dmg` |
| `linux-x64/` | `7zz` (static build `7zzs`, runs on any distro) | AppImage / `.deb` |

- Source: https://www.7-zip.org/download.html (`7z2604-x64.exe`,
  `7z2604-mac.tar.xz`, `7z2604-linux-x64.tar.xz`)
- `SHA256SUMS` lists the hashes; CI checks them before every build.
- License: `License.txt` (GNU LGPL + unRAR restriction). Corresponding source:
  https://www.7-zip.org/a/7z2604-src.tar.xz
- To update: `scripts/update-7zip.sh <version>` (e.g. `2605`), then commit.
