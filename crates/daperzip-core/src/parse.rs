//! Parsers for 7-Zip console output.
use std::collections::{BTreeMap, HashMap};

use crate::model::{ArchiveInfo, Entry};
use crate::paths::{archive_stem, WRITABLE_KINDS};

/// Parse the output of `7z l -slt <archive>`.
pub fn parse_slt(archive: &str, out: &str) -> ArchiveInfo {
    let out = out.replace("\r\n", "\n");
    let mut info = ArchiveInfo {
        path: archive.to_string(),
        ..Default::default()
    };

    let (head, body) = match out.find("\n----------\n") {
        Some(i) => (&out[..i], &out[i + 12..]),
        None => (out.as_str(), ""),
    };
    let props_part = match head.find("\n--\n") {
        Some(i) => &head[i + 4..],
        None => head,
    };
    let props = kv(props_part);
    info.kind = props.get("Type").cloned().unwrap_or_default();
    info.method = props.get("Method").cloned().unwrap_or_default();
    info.solid = props.get("Solid").map(|s| s == "+").unwrap_or(false);
    info.comment = props.get("Comment").cloned().unwrap_or_default();
    info.physical_size = props
        .get("Physical Size")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    info.encrypted_headers = props.get("Encrypted").map(|s| s == "+").unwrap_or(false)
        || (info.method.contains("7zAES") && props.contains_key("Headers Size") && body.is_empty());
    info.multi_volume = props
        .get("Volumes")
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(1)
        > 1
        || props.get("Multivolume").map(|s| s == "+").unwrap_or(false);

    let mut entries: BTreeMap<String, Entry> = BTreeMap::new();
    for block in body.split("\n\n") {
        let rec = kv(block);
        let Some(raw) = rec.get("Path") else { continue };
        let raw = raw.replace('\\', "/").trim_matches('/').to_string();
        if raw.is_empty() {
            continue;
        }
        let path = crate::names::nfc(&raw);
        let attrs = rec.get("Attributes").cloned().unwrap_or_default();
        let is_dir = rec.get("Folder").map(|s| s == "+").unwrap_or(false) || attrs.starts_with('D');
        let num = |k: &str| rec.get(k).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        let modified = rec
            .get("Modified")
            .map(|s| s.split('.').next().unwrap_or("").trim().to_string())
            .unwrap_or_default();
        entries.insert(
            path.clone(),
            Entry {
                path,
                raw,
                is_dir,
                size: num("Size"),
                packed: num("Packed Size"),
                modified,
                encrypted: rec.get("Encrypted").map(|s| s == "+").unwrap_or(false),
                crc: rec.get("CRC").cloned().unwrap_or_default(),
                method: rec.get("Method").cloned().unwrap_or_default(),
                attributes: attrs,
                implicit: false,
            },
        );
    }

    // Single-stream formats (gz, xz, bz2…) may list one entry without a name.
    let kind = info.kind.to_lowercase();
    if entries.is_empty()
        && ["gzip", "bzip2", "xz", "zstd", "lzma", "lzip"].contains(&kind.as_str())
    {
        let mut name = archive_stem(archive);
        let lower = archive.to_lowercase();
        if [
            ".tgz", ".tbz", ".tbz2", ".txz", ".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst",
        ]
        .iter()
        .any(|e| lower.ends_with(e))
        {
            name.push_str(".tar");
        }
        let mut e = Entry::dir(&name, false);
        e.is_dir = false;
        entries.insert(name, e);
    }

    // Synthesize missing parent folders (common in ZIPs made by some tools).
    // The raw name of an implicit folder is taken from its child's raw path
    // so 7-Zip can match it even when the archive uses NFD names.
    let known: Vec<(String, String)> = entries
        .values()
        .map(|e| (e.path.clone(), e.raw.clone()))
        .collect();
    for (k, raw) in known {
        let raw_parts: Vec<&str> = raw.split('/').collect();
        let parts: Vec<&str> = k.split('/').collect();
        for i in 1..parts.len() {
            let parent = parts[..i].join("/");
            entries.entry(parent.clone()).or_insert_with(|| {
                let mut d = Entry::dir(&parent, true);
                if raw_parts.len() == parts.len() {
                    d.raw = raw_parts[..i].join("/");
                }
                d
            });
        }
    }

    info.entries = entries.into_values().collect();
    info.writable = WRITABLE_KINDS.contains(&kind.as_str()) && !info.multi_volume;
    info
}

fn kv(block: &str) -> HashMap<String, String> {
    let mut m = HashMap::new();
    for line in block.lines() {
        if let Some((k, v)) = line.split_once(" = ") {
            m.insert(k.trim().to_string(), v.trim().to_string());
        } else if let Some(k) = line.strip_suffix(" =") {
            m.insert(k.trim().to_string(), String::new());
        }
    }
    m
}

/// Extract a `(percent, current file)` pair from one progress fragment
/// printed by `-bsp1`, e.g. ` 45% 12 - docs/readme.txt`.
pub fn parse_progress(fragment: &str) -> Option<(u8, String)> {
    let s = fragment.trim();
    let pct_end = s.find('%')?;
    let pct: u8 = s[..pct_end].trim().parse().ok()?;
    let rest = s[pct_end + 1..].trim();
    // optional file counter, then optional op marker ("-", "+", "U", "="…) then name
    let rest = rest
        .trim_start_matches(|c: char| c.is_ascii_digit())
        .trim_start();
    let name = match rest.split_once(' ') {
        Some((op, name)) if op.len() == 1 => name.trim().to_string(),
        _ => String::new(),
    };
    Some((pct.min(100), name))
}

/// First human-readable error line in 7-Zip output.
pub fn first_error(text: &str) -> Option<String> {
    text.lines().map(str::trim).find_map(|l| {
        if let Some(rest) = l.strip_prefix("ERROR:") {
            Some(rest.trim().to_string())
        } else if l.contains("Can not open")
            || l.contains("Cannot open")
            || l.contains("is not supported archive")
            || l.starts_with("E_")
            || l.contains("Unexpected end of archive")
            || l.contains("Data Error")
            || l.contains("CRC Failed")
        {
            Some(l.to_string())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "\n7-Zip 23.01\n\nListing archive: t.zip\n\n--\nPath = t.zip\nType = zip\nPhysical Size = 900\n\n----------\nPath = docs\\sub\\c.txt\nFolder = -\nSize = 2\nPacked Size = 2\nModified = 2026-11-05 04:14:33.1234567\nAttributes = A\nEncrypted = +\nCRC = 1234ABCD\nMethod = Store\n\nPath = a.txt\nFolder = -\nSize = 3\nPacked Size = 3\nModified = 2026-11-05 04:14:33\nEncrypted = -\n\n";

    #[test]
    fn slt() {
        let i = parse_slt("t.zip", SAMPLE);
        assert_eq!(i.kind, "zip");
        assert!(i.writable);
        let paths: Vec<_> = i.entries.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(paths, ["a.txt", "docs", "docs/sub", "docs/sub/c.txt"]);
        assert!(i.entries[1].implicit && i.entries[1].is_dir);
        assert_eq!(i.entries[3].modified, "2026-11-05 04:14:33");
        assert!(i.has_encrypted());
        assert_eq!(i.top_level_names(), ["a.txt", "docs"]);
    }

    #[test]
    fn progress() {
        assert_eq!(
            parse_progress(" 45% 12 - docs/a b.txt"),
            Some((45, "docs/a b.txt".into()))
        );
        assert_eq!(parse_progress("  0%"), Some((0, String::new())));
        assert_eq!(
            parse_progress("100% + 한글.txt"),
            Some((100, "한글.txt".into()))
        );
        assert_eq!(parse_progress("Scanning"), None);
    }
}
