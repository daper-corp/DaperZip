//! File-name helpers that do not need 7-Zip.
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use regex::Regex;

use crate::model::ArchiveInfo;

/// Extensions recognised as archives.
pub const ARCHIVE_EXTS: &[&str] = &[
    "7z", "zip", "rar", "tar", "gz", "tgz", "bz2", "tbz", "tbz2", "xz", "txz", "zst", "tzst", "lz",
    "lzma", "cab", "iso", "img", "wim", "arj", "lzh", "lha", "z", "taz", "cpio", "rpm", "deb",
    "dmg", "vhd", "vhdx", "xar", "jar", "war", "apk", "msi", "chm", "squashfs", "001", "zipx",
    "udf", "swm", "esd",
];

/// Formats 7-Zip can update in place.
pub const WRITABLE_KINDS: &[&str] = &["zip", "7z", "tar", "wim"];

fn multi_ext() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)(\.tar\.(gz|bz2|xz|zst|lz|lzma|z)$)|(\.(7z|zip|rar|tar)\.\d{3}$)|(\.part\d+\.rar$)|(\.z\d{2}$)",
        )
        .unwrap()
    })
}

pub fn is_archive(path: &str) -> bool {
    if multi_ext().is_match(path) {
        return true;
    }
    match Path::new(path).extension().and_then(|e| e.to_str()) {
        Some(ext) => ARCHIVE_EXTS.contains(&ext.to_lowercase().as_str()),
        None => false,
    }
}

/// `photos.tar.gz` → `photos`, `a.part1.rar` → `a`, `x.7z.001` → `x`.
pub fn archive_stem(path: &str) -> String {
    let name = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string());
    if let Some(m) = multi_ext().find(&name) {
        if m.start() > 0 {
            return name[..m.start()].to_string();
        }
    }
    match name.rfind('.') {
        Some(i) if i > 0 => name[..i].to_string(),
        _ => name,
    }
}

/// True for the 2nd and later parts of a split archive (we should open part 1).
pub fn is_later_volume(path: &str) -> bool {
    let lower = path.to_lowercase();
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"(\.\d{3}$)|(\.part(\d+)\.rar$)").unwrap());
    if let Some(c) = re.captures(&lower) {
        if c.get(1).is_some() {
            return !lower.ends_with(".001");
        }
        if let Some(n) = c.get(3) {
            return n.as_str().trim_start_matches('0') != "1";
        }
    }
    false
}

/// Return `path`, or `path (2)`, `path (3)`, … if it already exists.
pub fn unique_path(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }
    let parent = path.parent().unwrap_or(Path::new(""));
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let (stem, ext) = if path.is_dir() {
        (name.clone(), String::new())
    } else {
        match name.rfind('.') {
            Some(i) if i > 0 => (name[..i].to_string(), name[i..].to_string()),
            _ => (name.clone(), String::new()),
        }
    };
    (2..)
        .map(|i| parent.join(format!("{stem} ({i}){ext}")))
        .find(|p| !p.exists())
        .unwrap()
}

/// Decide where "smart extract" puts files.
///
/// One top-level item that doesn't already exist → next to the archive.
/// Otherwise → a new folder named after the archive.
/// Returns `(destination, created_new_folder)`.
pub fn smart_extract_target(info: &ArchiveInfo, archive: &Path) -> (PathBuf, bool) {
    let parent = archive
        .canonicalize()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .or_else(|| archive.parent().map(Path::to_path_buf))
        .unwrap_or_default();
    let tops = info.top_level_names();
    if tops.len() == 1 && !parent.join(&tops[0]).exists() {
        return (parent, false);
    }
    let stem = archive_stem(&archive.to_string_lossy());
    (unique_path(&parent.join(stem)), true)
}

/// Default archive path for compressing `sources` with extension `ext`.
pub fn default_archive_path(sources: &[PathBuf], ext: &str) -> PathBuf {
    let first = &sources[0];
    let parent = first.parent().unwrap_or(Path::new(".")).to_path_buf();
    let base = if sources.len() == 1 {
        let name = first
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();
        if first.is_dir() {
            name
        } else {
            match name.rfind('.') {
                Some(i) if i > 0 => name[..i].to_string(),
                _ => name,
            }
        }
    } else {
        parent
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "archive".into())
    };
    unique_path(&parent.join(format!("{base}{ext}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stems() {
        assert_eq!(archive_stem("/a/photos.tar.gz"), "photos");
        assert_eq!(archive_stem("x.part1.rar"), "x");
        assert_eq!(archive_stem("x.7z.001"), "x");
        assert_eq!(archive_stem("문서.zip"), "문서");
        assert_eq!(archive_stem(".hidden"), ".hidden");
    }

    #[test]
    fn archives() {
        assert!(is_archive("a.ZIP"));
        assert!(is_archive("a.tar.gz"));
        assert!(is_archive("a.7z.002"));
        assert!(!is_archive("a.txt"));
        assert!(is_later_volume("a.7z.002"));
        assert!(!is_later_volume("a.7z.001"));
        assert!(is_later_volume("a.part02.rar"));
        assert!(!is_later_volume("a.part01.rar"));
        assert!(!is_later_volume("a.zip"));
    }
}
