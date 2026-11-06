//! Windows Explorer integration.
//!
//! * Context menu on archives:  "DaperZip으로 압축 풀기 ▸ …"
//! * Context menu on any file / folder: "DaperZip으로 압축하기 ▸ …"
//! * "Open with" registration for archive extensions (ProgID `DaperZip.Archive`).
//!
//! The menu is written to `HKCU\Software\Classes` for a per-user install and
//! to `HKLM\Software\Classes` (all users) for a per-machine install. On
//! Windows 11 these classic entries appear under "Show more options".

/// Where Explorer integration is (or should be) registered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    /// Only the current user (HKCU). No admin rights needed.
    User,
    /// Every user of this PC (HKLM). Needs admin rights.
    Machine,
}

#[cfg(windows)]
mod imp {
    use super::Scope;
    use winreg::enums::*;
    use winreg::RegKey;

    const EXTRACT_KEY: &str = "DaperZip.Extract";
    const COMPRESS_KEY: &str = "DaperZip.Compress";
    const PROGID: &str = "DaperZip.Archive";
    const APP_KEY: &str = "DaperZip.exe";
    const REG_NAME: &str = "DaperZip";
    const CAPABILITIES: &str = "Software\\DaperZip\\Capabilities";

    /// Extensions that get the extract menu and the "Open with" entry.
    pub const EXTS: &[&str] = &[
        "7z", "zip", "rar", "tar", "gz", "tgz", "bz2", "tbz", "tbz2", "xz", "txz", "zst", "lz",
        "lzma", "cab", "iso", "wim", "arj", "lzh", "lha", "z", "cpio", "rpm", "deb", "001", "zipx",
        "jar", "apk", "dmg", "img", "vhd",
    ];

    fn exe() -> String {
        std::env::current_exe()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default()
    }

    fn root(scope: Scope) -> RegKey {
        RegKey::predef(match scope {
            Scope::User => HKEY_CURRENT_USER,
            Scope::Machine => HKEY_LOCAL_MACHINE,
        })
    }

    fn classes(scope: Scope) -> std::io::Result<RegKey> {
        root(scope)
            .create_subkey("Software\\Classes")
            .map(|(k, _)| k)
    }

    fn classes_ro(scope: Scope) -> Option<RegKey> {
        root(scope).open_subkey("Software\\Classes").ok()
    }

    fn registered_apps(scope: Scope) -> std::io::Result<RegKey> {
        root(scope)
            .create_subkey("Software\\RegisteredApplications")
            .map(|(k, _)| k)
    }

    fn capabilities(scope: Scope) -> std::io::Result<RegKey> {
        root(scope).create_subkey(CAPABILITIES).map(|(k, _)| k)
    }

    fn verb(parent: &RegKey, key: &str, label: &str, args: &str) -> std::io::Result<()> {
        let (k, _) = parent.create_subkey(key)?;
        k.set_value("MUIVerb", &label)?;
        let (c, _) = k.create_subkey("command")?;
        c.set_value("", &format!("\"{}\" {}", exe(), args))?;
        Ok(())
    }

    fn cascade(parent: &RegKey, key: &str, label: &str) -> std::io::Result<RegKey> {
        let (k, _) = parent.create_subkey(key)?;
        k.set_value("MUIVerb", &label)?;
        k.set_value("Icon", &format!("\"{}\",0", exe()))?;
        k.set_value("SubCommands", &"")?;
        k.set_value("MultiSelectModel", &"Player")?;
        let (s, _) = k.create_subkey("shell")?;
        Ok(s)
    }

    /// The install scope implied by where DaperZip.exe lives: a per-user
    /// install is under %LOCALAPPDATA%, a per-machine one under Program Files.
    pub fn install_scope() -> Scope {
        let exe = exe().to_lowercase();
        let local = std::env::var("LOCALAPPDATA")
            .unwrap_or_default()
            .to_lowercase();
        if !local.is_empty() && exe.starts_with(&local) {
            Scope::User
        } else {
            Scope::Machine
        }
    }

    pub fn register_menu(ko: bool, scope: Scope) -> std::io::Result<()> {
        let t = |k: &'static str, e: &'static str| if ko { k } else { e };
        let cls = classes(scope)?;
        for ext in EXTS {
            let (shell, _) = cls.create_subkey(format!("SystemFileAssociations\\.{ext}\\shell"))?;
            let sub = cascade(
                &shell,
                EXTRACT_KEY,
                t("DaperZip으로 압축 풀기", "Extract with DaperZip"),
            )?;
            verb(
                &sub,
                "1smart",
                t("여기에 풀기 (스마트)", "Smart extract here"),
                "--extract-smart \"%1\"",
            )?;
            verb(
                &sub,
                "2here",
                t("여기에 풀기", "Extract here"),
                "--extract-here \"%1\"",
            )?;
            verb(
                &sub,
                "3folder",
                t("압축 파일 이름의 폴더에 풀기", "Extract to folder"),
                "--extract-folder \"%1\"",
            )?;
            verb(
                &sub,
                "4dialog",
                t("다른 폴더에 풀기...", "Extract to..."),
                "--extract-dialog \"%1\"",
            )?;
            verb(
                &sub,
                "5open",
                t("DaperZip으로 열기", "Open with DaperZip"),
                "\"%1\"",
            )?;
        }
        for base in ["*\\shell", "Directory\\shell"] {
            let (shell, _) = cls.create_subkey(base)?;
            let sub = cascade(
                &shell,
                COMPRESS_KEY,
                t("DaperZip으로 압축하기", "Compress with DaperZip"),
            )?;
            verb(
                &sub,
                "1zip",
                t("ZIP으로 압축", "Compress to ZIP"),
                "--compress-zip \"%1\"",
            )?;
            verb(
                &sub,
                "27z",
                t("7Z로 압축", "Compress to 7Z"),
                "--compress-7z \"%1\"",
            )?;
            verb(
                &sub,
                "3dialog",
                t("압축하기...", "Add to archive..."),
                "--compress-dialog \"%1\"",
            )?;
        }
        notify();
        Ok(())
    }

    pub fn unregister_menu(scope: Scope) -> std::io::Result<()> {
        let Some(cls) = root(scope)
            .open_subkey_with_flags("Software\\Classes", KEY_ALL_ACCESS)
            .ok()
        else {
            return Ok(());
        };
        for ext in EXTS {
            let _ = cls.delete_subkey_all(format!(
                "SystemFileAssociations\\.{ext}\\shell\\{EXTRACT_KEY}"
            ));
        }
        for base in ["*\\shell", "Directory\\shell"] {
            let _ = cls.delete_subkey_all(format!("{base}\\{COMPRESS_KEY}"));
        }
        notify();
        Ok(())
    }

    /// Where the menu is currently registered (machine wins if both).
    pub fn menu_scope() -> Option<Scope> {
        [Scope::Machine, Scope::User].into_iter().find(|s| {
            classes_ro(*s)
                .map(|c| c.open_subkey(format!("*\\shell\\{COMPRESS_KEY}")).is_ok())
                .unwrap_or(false)
        })
    }

    pub fn register_assoc(scope: Scope) -> std::io::Result<()> {
        let cls = classes(scope)?;
        let (p, _) = cls.create_subkey(PROGID)?;
        p.set_value("", &"DaperZip Archive")?;
        p.set_value("FriendlyTypeName", &"DaperZip Archive")?;
        p.create_subkey("DefaultIcon")?
            .0
            .set_value("", &format!("\"{}\",0", exe()))?;
        p.create_subkey("shell\\open\\command")?
            .0
            .set_value("", &format!("\"{}\" \"%1\"", exe()))?;
        let (app, _) = cls.create_subkey(format!("Applications\\{APP_KEY}"))?;
        app.set_value("FriendlyAppName", &"DaperZip")?;
        app.set_value("ApplicationCompany", &"Daper")?;
        app.set_value("ApplicationIcon", &format!("\"{}\",0", exe()))?;
        let (sup, _) = app.create_subkey("SupportedTypes")?;

        let cap = capabilities(scope)?;
        cap.set_value("ApplicationName", &"DaperZip")?;
        cap.set_value("ApplicationDescription", &"DaperZip file archiver")?;
        let (files, _) = cap.create_subkey("FileAssociations")?;

        for ext in EXTS {
            let (k, _) = cls.create_subkey(format!(".{ext}\\OpenWithProgids"))?;
            k.set_value(PROGID, &"")?;
            sup.set_value(format!(".{ext}"), &"")?;
            files.set_value(format!(".{ext}"), &PROGID)?;
        }
        registered_apps(scope)?.set_value(REG_NAME, &CAPABILITIES)?;
        notify();
        Ok(())
    }

    pub fn unregister_assoc(scope: Scope) -> std::io::Result<()> {
        let cls = classes(scope)?;
        for ext in EXTS {
            if let Ok(k) =
                cls.open_subkey_with_flags(format!(".{ext}\\OpenWithProgids"), KEY_ALL_ACCESS)
            {
                let _ = k.delete_value(PROGID);
            }
        }
        let _ = cls.delete_subkey_all(PROGID);
        let _ = cls.delete_subkey_all(format!("Applications\\{APP_KEY}"));
        if let Ok(k) =
            root(scope).open_subkey_with_flags("Software\\RegisteredApplications", KEY_ALL_ACCESS)
        {
            let _ = k.delete_value(REG_NAME);
        }
        if let Ok(k) = root(scope).open_subkey_with_flags("Software\\DaperZip", KEY_ALL_ACCESS) {
            let _ = k.delete_subkey_all("Capabilities");
        }
        notify();
        Ok(())
    }

    fn assoc_in(scope: Scope) -> bool {
        if classes_ro(scope)
            .map(|c| c.open_subkey(PROGID).is_ok())
            .unwrap_or(false)
        {
            return true;
        }
        root(scope)
            .open_subkey("Software\\RegisteredApplications")
            .ok()
            .and_then(|k| k.get_value::<String, _>(REG_NAME).ok())
            .is_some()
    }

    pub fn assoc_scope() -> Option<Scope> {
        [Scope::Machine, Scope::User]
            .into_iter()
            .find(|s| assoc_in(*s))
    }

    pub fn assoc_registered() -> bool {
        assoc_scope().is_some()
    }

    fn notify() {
        use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
        unsafe {
            SHChangeNotify(
                SHCNE_ASSOCCHANGED as i32,
                SHCNF_IDLIST,
                std::ptr::null(),
                std::ptr::null(),
            )
        };
    }
}

#[cfg(not(windows))]
mod imp {
    use super::Scope;

    fn unsupported() -> std::io::Result<()> {
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Windows 전용 기능입니다.",
        ))
    }
    pub fn install_scope() -> Scope {
        Scope::User
    }
    pub fn register_menu(_ko: bool, _scope: Scope) -> std::io::Result<()> {
        unsupported()
    }
    pub fn unregister_menu(_scope: Scope) -> std::io::Result<()> {
        Ok(())
    }
    pub fn menu_scope() -> Option<Scope> {
        None
    }
    pub fn register_assoc(_scope: Scope) -> std::io::Result<()> {
        unsupported()
    }
    pub fn unregister_assoc(_scope: Scope) -> std::io::Result<()> {
        Ok(())
    }
    pub fn assoc_scope() -> Option<Scope> {
        None
    }
    pub fn assoc_registered() -> bool {
        false
    }
}

pub use imp::*;
