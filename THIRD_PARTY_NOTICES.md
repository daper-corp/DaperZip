# Third-party notices

## 7-Zip

DaperZip bundles the unmodified official 7-Zip console program (`7z.exe` +
`7z.dll` on Windows, `7zz` on macOS/Linux) and runs it as a separate process.

- Copyright (C) 1999-2026 Igor Pavlov — https://www.7-zip.org
- License: GNU LGPL v2.1 or later, with the **unRAR license restriction** for
  the RAR decompression code and BSD licenses for some parts. The full text
  ships next to the binary as `7zip/License.txt`.
- unRAR restriction: the unRAR source code cannot be used to develop a
  RAR (WinRAR) compatible archiver. DaperZip only *extracts* RAR archives
  through 7-Zip and never creates them.
- Version: 26.04, stored unmodified in `vendor/7zip/` (hashes in `SHA256SUMS`)
- Source code: https://www.7-zip.org/a/7z2604-src.tar.xz (all versions:
  https://www.7-zip.org/download.html)

You can replace the bundled binaries with any other 7-Zip build (Settings →
Engine → 7-Zip path), as the LGPL allows.

## Rust and JavaScript dependencies

DaperZip is built with Tauri (MIT/Apache-2.0) and other crates under MIT,
Apache-2.0 or similarly permissive licenses. Run `cargo about` or
`cargo license` for the full list.
