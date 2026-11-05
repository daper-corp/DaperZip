use serde::Serialize;

/// One item inside an archive.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    /// Display path: `/`-separated, no leading slash, Unicode NFC.
    pub path: String,
    /// The name exactly as stored in the archive (`/`-separated). Use this
    /// when passing items back to 7-Zip; it differs from `path` for names
    /// written in decomposed form (NFD) by macOS.
    pub raw: String,
    pub is_dir: bool,
    pub size: u64,
    pub packed: u64,
    /// "YYYY-MM-DD HH:MM:SS" as reported by 7-Zip (local time), or empty.
    pub modified: String,
    pub encrypted: bool,
    pub crc: String,
    pub method: String,
    pub attributes: String,
    /// Folder that has no entry of its own (synthesised from child paths).
    pub implicit: bool,
}

impl Entry {
    pub fn dir(path: &str, implicit: bool) -> Self {
        Entry {
            path: path.to_string(),
            raw: path.to_string(),
            is_dir: true,
            size: 0,
            packed: 0,
            modified: String::new(),
            encrypted: false,
            crc: String::new(),
            method: String::new(),
            attributes: String::new(),
            implicit,
        }
    }

    pub fn name(&self) -> &str {
        self.path.rsplit('/').next().unwrap_or(&self.path)
    }

    pub fn parent(&self) -> &str {
        match self.path.rfind('/') {
            Some(i) => &self.path[..i],
            None => "",
        }
    }
}

/// Result of listing an archive.
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInfo {
    pub path: String,
    /// 7-Zip type name, e.g. "zip", "7z", "Rar5", "gzip".
    pub kind: String,
    pub physical_size: u64,
    pub method: String,
    pub solid: bool,
    pub encrypted_headers: bool,
    pub comment: String,
    /// Whether 7-Zip can modify this format in place (add/delete/rename).
    pub writable: bool,
    pub multi_volume: bool,
    /// Set when the ZIP stores names in a legacy code page (e.g. "949").
    pub legacy_codepage: String,
    pub entries: Vec<Entry>,
}

impl ArchiveInfo {
    pub fn has_encrypted(&self) -> bool {
        self.encrypted_headers || self.entries.iter().any(|e| e.encrypted)
    }

    pub fn total_size(&self) -> u64 {
        self.entries
            .iter()
            .filter(|e| !e.is_dir)
            .map(|e| e.size)
            .sum()
    }

    pub fn file_count(&self) -> usize {
        self.entries.iter().filter(|e| !e.is_dir).count()
    }

    /// Distinct first path components.
    pub fn top_level_names(&self) -> Vec<String> {
        let mut v: Vec<String> = self
            .entries
            .iter()
            .map(|e| e.path.split('/').next().unwrap_or("").to_string())
            .collect();
        v.sort();
        v.dedup();
        v
    }
}

/// Formats DaperZip can create.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Zip,
    #[serde(rename = "7z")]
    SevenZ,
    Tar,
    Tgz,
    Tbz,
    Txz,
    Wim,
}

impl Format {
    pub fn switch(self) -> &'static str {
        match self {
            Format::Zip => "zip",
            Format::SevenZ => "7z",
            Format::Tar => "tar",
            Format::Tgz => "gzip",
            Format::Tbz => "bzip2",
            Format::Txz => "xz",
            Format::Wim => "wim",
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            Format::Zip => ".zip",
            Format::SevenZ => ".7z",
            Format::Tar => ".tar",
            Format::Tgz => ".tar.gz",
            Format::Tbz => ".tar.bz2",
            Format::Txz => ".tar.xz",
            Format::Wim => ".wim",
        }
    }

    pub fn is_compressed_tar(self) -> bool {
        matches!(self, Format::Tgz | Format::Tbz | Format::Txz)
    }

    pub fn from_path(path: &str) -> Option<Format> {
        let p = path.to_lowercase();
        Some(if p.ends_with(".zip") {
            Format::Zip
        } else if p.ends_with(".7z") {
            Format::SevenZ
        } else if p.ends_with(".tar.gz") || p.ends_with(".tgz") {
            Format::Tgz
        } else if p.ends_with(".tar.bz2") || p.ends_with(".tbz") || p.ends_with(".tbz2") {
            Format::Tbz
        } else if p.ends_with(".tar.xz") || p.ends_with(".txz") {
            Format::Txz
        } else if p.ends_with(".tar") {
            Format::Tar
        } else if p.ends_with(".wim") {
            Format::Wim
        } else {
            return None;
        })
    }
}

/// What to do when an extracted file already exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Overwrite {
    /// Replace existing files.
    Overwrite,
    /// Keep existing files.
    Skip,
    /// Keep both: give the new file a new name ("name (2).txt").
    #[default]
    Rename,
}

impl Overwrite {
    pub fn switch(self) -> &'static str {
        match self {
            Overwrite::Overwrite => "-aoa",
            Overwrite::Skip => "-aos",
            Overwrite::Rename => "-aou",
        }
    }
}

/// Options for creating / updating an archive.
#[derive(Debug, Clone, serde::Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AddOptions {
    pub format: Option<Format>,
    /// 0 (store) ..= 9 (ultra)
    pub level: u8,
    pub password: Option<String>,
    /// 7z only: encrypt the file list too.
    pub encrypt_names: bool,
    /// ZIP only: AES-256 instead of legacy ZipCrypto.
    pub zip_aes: bool,
    /// e.g. "100m", "4092m"; empty = no split
    pub volume_size: String,
    /// Put the sources inside this folder of the archive.
    pub archive_dir: String,
    /// 0 = let 7-Zip decide.
    pub threads: u32,
    /// Leave out macOS metadata (.DS_Store, ._*, __MACOSX).
    pub exclude_mac_junk: bool,
}

impl Default for AddOptions {
    fn default() -> Self {
        AddOptions {
            format: None,
            level: 5,
            password: None,
            encrypt_names: false,
            zip_aes: true,
            volume_size: String::new(),
            archive_dir: String::new(),
            threads: 0,
            exclude_mac_junk: true,
        }
    }
}
