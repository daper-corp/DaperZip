//! File-name fixes so archives look right on every OS.
//!
//! Two classic problems:
//!
//! 1. **macOS NFD names.** macOS stores Korean (and other) names in
//!    decomposed form (NFD), e.g. `한` becomes `ㅎ`+`ㅏ`+`ㄴ`. Archives made on a
//!    Mac then show broken, letter-by-letter names on Windows. DaperZip shows
//!    and extracts names in composed form (NFC) and writes NFC when it
//!    creates archives.
//! 2. **Legacy-encoded ZIPs.** Old Windows tools store names in the system
//!    code page (CP949 for Korean) without the UTF-8 flag. Windows' 7-Zip
//!    can decode those with `-mcp=949`, but 7-Zip on macOS/Linux cannot.
//!    There DaperZip makes a temporary copy of the ZIP whose names are
//!    re-encoded as UTF-8 (compressed data is copied byte for byte) and lets
//!    7-Zip work on that copy.
use std::fs;
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};

use unicode_normalization::{is_nfc, UnicodeNormalization};

pub fn nfc(s: &str) -> String {
    if is_nfc(s) {
        s.to_string()
    } else {
        s.nfc().collect()
    }
}

pub fn is_nfc_str(s: &str) -> bool {
    is_nfc(s)
}

/// True if any file or folder under `paths` (recursively) has a non-NFC name.
pub fn tree_has_non_nfc(paths: &[PathBuf]) -> bool {
    fn walk(p: &Path, depth: usize) -> bool {
        if let Some(n) = p.file_name().and_then(|n| n.to_str()) {
            if !is_nfc(n) {
                return true;
            }
        }
        if depth < 64
            && p.is_dir()
            && !fs::symlink_metadata(p)
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false)
        {
            if let Ok(rd) = fs::read_dir(p) {
                for e in rd.flatten() {
                    if walk(&e.path(), depth + 1) {
                        return true;
                    }
                }
            }
        }
        false
    }
    paths.iter().any(|p| walk(p, 0))
}

/// Same file system object? (APFS treats NFD/NFC spellings as one name.)
fn same_file(a: &Path, b: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        match (fs::symlink_metadata(a), fs::symlink_metadata(b)) {
            (Ok(x), Ok(y)) => x.dev() == y.dev() && x.ino() == y.ino(),
            _ => false,
        }
    }
    #[cfg(not(unix))]
    {
        let _ = (a, b);
        false
    }
}

/// Rename `path` and everything below it to NFC. Returns the new path.
pub fn normalize_tree(path: &Path) -> PathBuf {
    let mut cur = path.to_path_buf();
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        let fixed = nfc(name);
        if fixed != name {
            let target = path.with_file_name(&fixed);
            if (!target.exists() || same_file(path, &target)) && fs::rename(path, &target).is_ok() {
                cur = target;
            }
        }
    }
    if cur.is_dir()
        && !fs::symlink_metadata(&cur)
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(false)
    {
        if let Ok(rd) = fs::read_dir(&cur) {
            let children: Vec<PathBuf> = rd.flatten().map(|e| e.path()).collect();
            for c in children {
                normalize_tree(&c);
            }
        }
    }
    cur
}

// ---------------------------------------------------------------------------
// Legacy ZIP name encodings
// ---------------------------------------------------------------------------

/// Map a Windows code page number to an encoding.
pub fn encoding_for(codepage: &str) -> Option<&'static encoding_rs::Encoding> {
    use encoding_rs::*;
    Some(match codepage {
        "949" | "euc-kr" | "cp949" => EUC_KR,
        "932" | "shift_jis" => SHIFT_JIS,
        "936" | "gbk" => GBK,
        "950" | "big5" => BIG5,
        "866" => IBM866,
        "1251" => WINDOWS_1251,
        "1252" => WINDOWS_1252,
        _ => return None,
    })
}

/// Information about a ZIP whose names are not UTF-8.
#[derive(Debug, Clone)]
pub struct LegacyZip {
    /// Code page that decodes the names cleanly, e.g. "949".
    pub codepage: String,
}

fn looks_like_zip(path: &Path) -> bool {
    use std::io::Read;
    let mut sig = [0u8; 4];
    fs::File::open(path)
        .and_then(|mut f| f.read_exact(&mut sig))
        .is_ok()
        && &sig == b"PK\x03\x04"
}

/// Detect a ZIP that stores names in a legacy code page.
///
/// `preferred` is the user's code-page setting ("" = auto). In auto mode
/// Korean CP949 is tried first, then Japanese, Chinese.
pub fn detect_legacy_zip(path: &Path, preferred: &str) -> Option<LegacyZip> {
    if !looks_like_zip(path) {
        return None;
    }
    let file = fs::File::open(path).ok()?;
    let mut zip = zip::ZipArchive::new(BufReader::new(file)).ok()?;
    let mut raw_names: Vec<Vec<u8>> = Vec::new();
    for i in 0..zip.len() {
        let f = zip.by_index_raw(i).ok()?;
        let raw = f.name_raw().to_vec();
        if std::str::from_utf8(&raw).is_err() {
            raw_names.push(raw);
        }
        if raw_names.len() >= 200 {
            break;
        }
    }
    if raw_names.is_empty() {
        return None;
    }
    let candidates: Vec<&str> = if preferred.is_empty() || preferred == "65001" {
        vec!["949", "932", "936", "950"]
    } else {
        vec![preferred]
    };
    for cp in &candidates {
        let Some(enc) = encoding_for(cp) else {
            continue;
        };
        if raw_names
            .iter()
            .all(|r| !enc.decode_without_bom_handling(r).1)
        {
            return Some(LegacyZip {
                codepage: cp.to_string(),
            });
        }
    }
    // Nothing decodes cleanly: fall back to the first candidate anyway.
    Some(LegacyZip {
        codepage: candidates[0].to_string(),
    })
}

/// Write a copy of `src` to `dst` with every non-UTF-8 name re-encoded as
/// UTF-8 (from `codepage`). File data is copied without recompression.
pub fn transcode_zip(src: &Path, dst: &Path, codepage: &str) -> std::io::Result<()> {
    let enc = encoding_for(codepage).unwrap_or(encoding_rs::EUC_KR);
    let io = |e: zip::result::ZipError| std::io::Error::other(e.to_string());
    let mut zin = zip::ZipArchive::new(BufReader::new(fs::File::open(src)?)).map_err(io)?;
    let mut zout = zip::ZipWriter::new(BufWriter::new(fs::File::create(dst)?));
    for i in 0..zin.len() {
        let f = zin.by_index_raw(i).map_err(io)?;
        let name = match std::str::from_utf8(f.name_raw()) {
            Ok(s) => s.to_string(),
            Err(_) => enc.decode_without_bom_handling(f.name_raw()).0.into_owned(),
        };
        zout.raw_copy_file_rename(f, nfc(&name)).map_err(io)?;
    }
    zout.finish().map_err(io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nfc_basics() {
        let nfd: String = "한글.txt".nfd().collect();
        assert_ne!(nfd, "한글.txt");
        assert_eq!(nfc(&nfd), "한글.txt");
        assert!(is_nfc_str("한글.txt"));
    }

    #[test]
    fn normalize_files_on_disk() {
        let t = tempfile::tempdir().unwrap();
        let dir: String = "폴더".nfd().collect();
        let file: String = "보고서.txt".nfd().collect();
        fs::create_dir(t.path().join(&dir)).unwrap();
        fs::write(t.path().join(&dir).join(&file), "x").unwrap();
        let out = normalize_tree(&t.path().join(&dir));
        assert_eq!(out, t.path().join("폴더"));
        assert_eq!(
            fs::read_to_string(t.path().join("폴더").join("보고서.txt")).unwrap(),
            "x"
        );
        assert!(!tree_has_non_nfc(&[t.path().to_path_buf()]));
    }
}
