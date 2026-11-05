//! User settings, stored as JSON in the app config directory.
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// "system" | "ko" | "en"
    pub language: String,
    /// "system" | "light" | "dark"
    pub theme: String,
    /// Empty = auto-detect (bundled 7zip folder, PATH, Program Files).
    pub sevenzip_path: String,
    /// ZIP file-name code page: "" auto, "949" Korean, "65001" UTF-8.
    pub codepage: String,
    pub compress_format: String,
    pub compress_level: u8,
    pub compress_open_folder: bool,
    /// "overwrite" | "skip" | "rename"
    pub extract_overwrite: String,
    pub extract_open_folder: bool,
    pub extract_history: Vec<String>,
    /// Offer to update the archive when a file opened from it is modified.
    pub watch_opened_files: bool,
    /// Convert macOS decomposed (NFD) names to normal (NFC) form.
    pub normalize_names: bool,
    /// Skip .DS_Store / __MACOSX / ._* files.
    pub skip_mac_junk: bool,
    pub recent: Vec<String>,
    /// Explorer menu was set up once (by first run or by the user).
    pub shell_menu_configured: bool,
    /// Look for a new version on GitHub when DaperZip starts.
    pub check_updates: bool,
    /// Version the user chose to skip.
    pub skipped_version: String,
    /// Language the Explorer menu labels were written in ("ko" | "en").
    pub shell_menu_lang: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            language: "system".into(),
            theme: "system".into(),
            sevenzip_path: String::new(),
            codepage: String::new(),
            compress_format: "zip".into(),
            compress_level: 5,
            compress_open_folder: false,
            extract_overwrite: "rename".into(),
            extract_open_folder: true,
            extract_history: vec![],
            watch_opened_files: true,
            normalize_names: true,
            skip_mac_junk: true,
            recent: vec![],
            shell_menu_configured: false,
            check_updates: true,
            skipped_version: String::new(),
            shell_menu_lang: String::new(),
        }
    }
}

impl Settings {
    pub fn load(path: &PathBuf) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &PathBuf) -> std::io::Result<()> {
        if let Some(d) = path.parent() {
            std::fs::create_dir_all(d)?;
        }
        std::fs::write(path, serde_json::to_string_pretty(self).unwrap())
    }

    pub fn push_recent(&mut self, path: &str) {
        self.recent.retain(|p| p != path);
        self.recent.insert(0, path.to_string());
        self.recent.truncate(12);
    }
}
