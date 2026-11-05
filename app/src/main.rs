// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod settings;
mod shell;
mod update;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};

use daperzip_core::{
    archive_stem, default_archive_path, is_archive, is_later_volume, smart_extract_target,
    unique_path, AddOptions, ArchiveInfo, CancelToken, Error as CoreError, Format, Overwrite,
    SevenZip,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use settings::Settings;
use tauri::{
    AppHandle, Emitter, Manager, RunEvent, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowArgs {
    /// "main" | "task"
    mode: String,
    /// for task windows: extract-smart | extract-here | extract-folder |
    /// extract-dialog | compress-zip | compress-7z | compress-dialog
    action: String,
    paths: Vec<String>,
}

struct Watched {
    window: String,
    archive: String,
    archive_dir: String,
    path: PathBuf,
    mtime: Option<SystemTime>,
}

struct AppState {
    settings: Mutex<Settings>,
    settings_path: PathBuf,
    extra_7z_dirs: Vec<PathBuf>,
    window_args: Mutex<HashMap<String, WindowArgs>>,
    jobs: Mutex<HashMap<u64, CancelToken>>,
    next_id: AtomicU64,
    pending: Mutex<Option<(String, Vec<String>)>>,
    watched: Mutex<Vec<Watched>>,
    clipboard: Mutex<Option<clipboard_rs::ClipboardContext>>,
    session_dir: PathBuf,
    /// archive path → how 7-Zip should read it (legacy-encoded ZIPs)
    resolved: Mutex<HashMap<String, Resolved>>,
    /// The automatic update check runs once per app process.
    update_checked: std::sync::atomic::AtomicBool,
}

#[derive(Clone)]
struct Resolved {
    stamp: Option<SystemTime>,
    /// File 7-Zip should read (a UTF-8 copy for legacy ZIPs on macOS/Linux).
    effective: PathBuf,
    /// Code page to pass with -mcp (Windows only).
    codepage: String,
    /// Detected legacy code page, for display.
    legacy: String,
}

impl AppState {
    fn engine(&self) -> Result<SevenZip, ErrorPayload> {
        let s = self.settings.lock().unwrap();
        let exe = if !s.sevenzip_path.is_empty() && Path::new(&s.sevenzip_path).is_file() {
            PathBuf::from(&s.sevenzip_path)
        } else {
            daperzip_core::find_7zip(&self.extra_7z_dirs)
                .ok_or_else(|| ErrorPayload::from(CoreError::NotFound))?
        };
        Ok(SevenZip {
            exe,
            codepage: s.codepage.clone(),
            normalize_names: s.normalize_names,
            skip_mac_junk: s.skip_mac_junk,
        })
    }

    /// Engine + path to use for *reading* `archive`.
    ///
    /// ZIPs whose names use a legacy code page (e.g. CP949) are read with
    /// `-mcp` on Windows; elsewhere through a copy with UTF-8 names.
    fn reader(&self, archive: &str) -> Result<(SevenZip, PathBuf, String), ErrorPayload> {
        let mut z = self.engine()?;
        let stamp = std::fs::metadata(archive).and_then(|m| m.modified()).ok();
        if let Some(r) = self
            .resolved
            .lock()
            .unwrap()
            .get(archive)
            .filter(|r| r.stamp == stamp)
            .cloned()
        {
            if !r.codepage.is_empty() {
                z.codepage = r.codepage.clone();
            }
            return Ok((z, r.effective, r.legacy));
        }
        let preferred = z.codepage.clone();
        let mut r = Resolved {
            stamp,
            effective: PathBuf::from(archive),
            codepage: String::new(),
            legacy: String::new(),
        };
        if let Some(l) = daperzip_core::names::detect_legacy_zip(Path::new(archive), &preferred) {
            r.legacy = l.codepage.clone();
            if cfg!(windows) {
                r.codepage = l.codepage;
            } else {
                std::fs::create_dir_all(&self.session_dir)?;
                let copy = self.session_dir.join(format!("legacy-{}.zip", self.id()));
                daperzip_core::names::transcode_zip(Path::new(archive), &copy, &l.codepage)?;
                r.effective = copy;
            }
        }
        self.resolved
            .lock()
            .unwrap()
            .insert(archive.to_string(), r.clone());
        if !r.codepage.is_empty() {
            z.codepage = r.codepage;
        }
        Ok((z, r.effective, r.legacy))
    }

    fn save_settings(&self) {
        let _ = self.settings.lock().unwrap().save(&self.settings_path);
    }

    fn id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::SeqCst)
    }
}

#[derive(Debug, Clone, Serialize)]
struct ErrorPayload {
    code: String,
    message: String,
    details: String,
}

impl From<CoreError> for ErrorPayload {
    fn from(e: CoreError) -> Self {
        ErrorPayload {
            code: e.code().into(),
            message: e.to_string(),
            details: e.details().into(),
        }
    }
}

impl From<std::io::Error> for ErrorPayload {
    fn from(e: std::io::Error) -> Self {
        ErrorPayload {
            code: "io".into(),
            message: e.to_string(),
            details: String::new(),
        }
    }
}

impl From<String> for ErrorPayload {
    fn from(message: String) -> Self {
        ErrorPayload {
            code: "other".into(),
            message,
            details: String::new(),
        }
    }
}

type CmdResult<T> = Result<T, ErrorPayload>;

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

fn create_window(app: &AppHandle, args: WindowArgs) -> tauri::Result<()> {
    let state = app.state::<AppState>();
    let label = format!("{}-{}", args.mode, state.id());
    let (w, h, resizable) = match (args.mode.as_str(), args.action.as_str()) {
        ("main", _) => (1040.0, 680.0, true),
        (_, "compress-dialog") => (560.0, 600.0, true),
        _ => (480.0, 230.0, false),
    };
    let title = "DaperZip";
    state
        .window_args
        .lock()
        .unwrap()
        .insert(label.clone(), args);
    let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(w, h)
        .min_inner_size(
            if resizable { 420.0 } else { w },
            if resizable { 220.0 } else { h },
        )
        .resizable(resizable)
        .center()
        .visible(true)
        .build()?;
    let _ = win.set_focus();
    Ok(())
}

fn main_window(app: &AppHandle, path: Option<String>) {
    let _ = create_window(
        app,
        WindowArgs {
            mode: "main".into(),
            action: String::new(),
            paths: path.into_iter().collect(),
        },
    );
}

/// Parse command-line arguments: returns (action, paths).
fn parse_args(argv: &[String], cwd: &Path) -> (String, Vec<String>) {
    let mut action = String::new();
    let mut paths = Vec::new();
    for a in argv.iter().skip(1) {
        if let Some(flag) = a.strip_prefix("--") {
            action = flag.to_string();
        } else if !a.is_empty() {
            let p = Path::new(a);
            let p = if p.is_absolute() {
                p.to_path_buf()
            } else {
                cwd.join(p)
            };
            paths.push(p.to_string_lossy().into_owned());
        }
    }
    (action, paths)
}

const BATCH_ACTIONS: &[&str] = &[
    "extract-smart",
    "extract-here",
    "extract-folder",
    "extract-dialog",
    "compress-zip",
    "compress-7z",
    "compress-dialog",
];

/// Explorer launches one process per selected file. The single-instance
/// plugin forwards them here; we collect them for a short moment so a
/// multi-selection becomes one batch (one archive / one progress window).
fn handle_invocation(app: &AppHandle, action: String, paths: Vec<String>) {
    if BATCH_ACTIONS.contains(&action.as_str()) {
        let state = app.state::<AppState>();
        let mut pending = state.pending.lock().unwrap();
        match pending.as_mut() {
            Some((a, p)) if *a == action => p.extend(paths),
            _ => {
                *pending = Some((action, paths));
                let app = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(400));
                    let batch = app.state::<AppState>().pending.lock().unwrap().take();
                    if let Some((action, mut paths)) = batch {
                        paths.dedup();
                        let _ = create_window(
                            &app,
                            WindowArgs {
                                mode: "task".into(),
                                action,
                                paths,
                            },
                        );
                    }
                });
            }
        }
        return;
    }
    if paths.is_empty() {
        main_window(app, None);
    } else {
        for p in paths {
            main_window(app, Some(p));
        }
    }
}

// ---------------------------------------------------------------------------
// Commands: misc
// ---------------------------------------------------------------------------

#[tauri::command]
fn window_args(window: WebviewWindow, state: State<AppState>) -> Option<WindowArgs> {
    state
        .window_args
        .lock()
        .unwrap()
        .get(window.label())
        .cloned()
}

#[tauri::command]
fn app_info(state: State<AppState>) -> Value {
    let engine = state.engine();
    let (path, version, error) = match &engine {
        Ok(e) => (
            e.exe.to_string_lossy().into_owned(),
            e.version().unwrap_or_default(),
            String::new(),
        ),
        Err(e) => (String::new(), String::new(), e.message.clone()),
    };
    json!({
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "sevenzip": { "path": path, "version": version, "error": error },
        "shellMenu": shell::menu_scope().is_some(),
        "shellMenuScope": shell::menu_scope(),
        "assoc": shell::assoc_registered(),
    })
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn set_settings(app: AppHandle, state: State<AppState>, settings: Settings) {
    let changed_look = {
        let old = state.settings.lock().unwrap();
        old.language != settings.language || old.theme != settings.theme
    };
    *state.settings.lock().unwrap() = settings;
    state.save_settings();
    // language / theme apply to every open window right away
    if changed_look {
        let _ = app.emit("appearance-changed", ());
    }
}

/// Keep the Explorer menu labels in the UI language (`ko` resolved by the UI,
/// so "system" works too). Only touches a per-user menu, and only on change.
#[tauri::command]
fn sync_shell_language(state: State<AppState>, ko: bool) {
    let lang = if ko { "ko" } else { "en" };
    if state.settings.lock().unwrap().shell_menu_lang == lang {
        return;
    }
    if shell::menu_scope() == Some(shell::Scope::User)
        && shell::register_menu(ko, shell::Scope::User).is_ok()
    {
        state.settings.lock().unwrap().shell_menu_lang = lang.into();
        state.save_settings();
    }
}

// Window-creating commands must be async: on Windows a window built inside a
// synchronous command never gets its WebView content (it stays blank).
#[tauri::command]
async fn open_window(app: AppHandle, path: Option<String>) {
    main_window(&app, path);
}

#[tauri::command]
async fn open_task_window(app: AppHandle, action: String, paths: Vec<String>) -> CmdResult<()> {
    create_window(
        &app,
        WindowArgs {
            mode: "task".into(),
            action,
            paths,
        },
    )
    .map_err(|e| e.to_string().into())
}

#[tauri::command]
fn open_path(path: String) -> CmdResult<()> {
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string().into())
}

/// Open a web page in the default browser (https links only).
#[tauri::command]
fn open_url(url: String) -> CmdResult<()> {
    if !url.starts_with("https://") {
        return Err(ErrorPayload::from(
            "https 주소만 열 수 있습니다.".to_string(),
        ));
    }
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string().into())
}

#[tauri::command]
fn reveal_path(path: String) -> CmdResult<()> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string().into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PathInfo {
    path: String,
    name: String,
    is_dir: bool,
    size: u64,
    is_archive: bool,
    exists: bool,
}

#[tauri::command]
fn path_info(paths: Vec<String>) -> Vec<PathInfo> {
    paths
        .into_iter()
        .map(|p| {
            let meta = std::fs::metadata(&p).ok();
            let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
            PathInfo {
                name: Path::new(&p)
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| p.clone()),
                is_dir,
                size: meta
                    .as_ref()
                    .map(|m| if m.is_dir() { 0 } else { m.len() })
                    .unwrap_or(0),
                is_archive: !is_dir && is_archive(&p),
                exists: meta.is_some(),
                path: p,
            }
        })
        .collect()
}

#[tauri::command]
fn suggest_archive_path(sources: Vec<String>, format: Format) -> String {
    let srcs: Vec<PathBuf> = sources.iter().map(PathBuf::from).collect();
    if srcs.is_empty() {
        return String::new();
    }
    default_archive_path(&srcs, format.extension())
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
fn archive_name(path: String) -> String {
    archive_stem(&path)
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Check GitHub for a newer release. `manual` = the user pressed
/// "check now" (ignores the once-per-run limit, the setting and skipped
/// versions). Returns null when up to date, offline, or not checking.
#[tauri::command]
async fn check_update(app: AppHandle, manual: bool) -> CmdResult<Option<update::UpdateInfo>> {
    let state = app.state::<AppState>();
    if !manual {
        let enabled = state.settings.lock().unwrap().check_updates;
        if !enabled || state.update_checked.swap(true, Ordering::SeqCst) {
            return Ok(None);
        }
    }
    let skipped = state.settings.lock().unwrap().skipped_version.clone();
    let result = tauri::async_runtime::spawn_blocking(update::check)
        .await
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    match result {
        Ok(Some(info)) if manual || info.latest != skipped => Ok(Some(info)),
        Ok(_) => Ok(None),
        // offline / GitHub unreachable: stay quiet unless the user asked
        Err(e) if manual => Err(ErrorPayload::from(e)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn skip_update(state: State<AppState>, version: String) {
    state.settings.lock().unwrap().skipped_version = version;
    state.save_settings();
}

/// Windows: download the installer, start it and quit so it can replace
/// the running files. Other platforms: open the release page.
#[tauri::command]
async fn install_update(
    app: AppHandle,
    asset_url: Option<String>,
    asset_name: Option<String>,
    page: String,
) -> CmdResult<()> {
    match (cfg!(windows), asset_url, asset_name) {
        (true, Some(url), Some(name)) => {
            let path = tauri::async_runtime::spawn_blocking(move || update::download(&url, &name))
                .await
                .map_err(|e| ErrorPayload::from(e.to_string()))?
                .map_err(ErrorPayload::from)?;
            std::process::Command::new(&path).spawn()?;
            app.exit(0);
            Ok(())
        }
        _ => tauri_plugin_opener::open_url(page, None::<&str>).map_err(|e| e.to_string().into()),
    }
}

#[tauri::command]
fn set_shell_menu(state: State<AppState>, enabled: bool) -> CmdResult<()> {
    let ko = {
        let mut s = state.settings.lock().unwrap();
        s.shell_menu_configured = true;
        s.language != "en"
    };
    state.save_settings();
    if enabled {
        shell::register_menu(ko, shell::Scope::User)?;
    } else {
        shell::unregister_menu(shell::Scope::User)?;
    }
    Ok(())
}

#[tauri::command]
fn set_file_assoc(enabled: bool) -> CmdResult<()> {
    if enabled {
        shell::register_assoc()?;
    } else {
        shell::unregister_assoc()?;
    }
    Ok(())
}

#[tauri::command]
fn open_default_apps() -> CmdResult<()> {
    tauri_plugin_opener::open_url("ms-settings:defaultapps", None::<&str>)
        .map_err(|e| e.to_string().into())
}

// ---------------------------------------------------------------------------
// Commands: archive operations
// ---------------------------------------------------------------------------

#[tauri::command]
async fn list_archive(
    app: AppHandle,
    path: String,
    password: Option<String>,
) -> CmdResult<ArchiveInfo> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let mut p = PathBuf::from(&path);
        // Opening ".7z.002" etc. should show the whole set: switch to part 1.
        if is_later_volume(&path) {
            let s = path.clone();
            let first = if let Some(i) = s.to_lowercase().rfind(".part") {
                let tail = &s[i + 5..];
                let digits = tail.chars().take_while(|c| c.is_ascii_digit()).count();
                format!(
                    "{}.part{}{}",
                    &s[..i],
                    format!("{:0width$}", 1, width = digits),
                    &tail[digits..]
                )
            } else {
                format!("{}.001", &s[..s.len() - 4])
            };
            if Path::new(&first).exists() {
                p = PathBuf::from(first);
            }
        }
        let original = p.to_string_lossy().into_owned();
        let (z, effective, legacy) = state.reader(&original)?;
        let mut info = z.list(&effective, password.as_deref())?;
        info.path = original;
        if !legacy.is_empty() {
            info.legacy_codepage = legacy;
            // a re-encoded copy can't be written back to the original
            if !cfg!(windows) {
                info.writable = false;
            }
        }
        {
            let mut s = state.settings.lock().unwrap();
            s.push_recent(&p.to_string_lossy());
        }
        state.save_settings();
        Ok(info)
    })
    .await
    .map_err(|e| ErrorPayload::from(e.to_string()))?
}

#[tauri::command]
fn rename_entry(
    state: State<AppState>,
    archive: String,
    old: String,
    new: String,
    password: Option<String>,
) -> CmdResult<()> {
    Ok(state
        .engine()?
        .rename(Path::new(&archive), &[(old, new)], password.as_deref())?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
enum Job {
    /// Extract everything (items empty) or the selected items relative to `base`.
    Extract {
        archive: String,
        dest: String,
        #[serde(default)]
        items: Vec<String>,
        #[serde(default)]
        base: String,
        password: Option<String>,
        #[serde(default)]
        overwrite: Overwrite,
    },
    /// "smart" | "here" | "folder"
    ExtractAuto {
        archive: String,
        mode: String,
        password: Option<String>,
        #[serde(default)]
        overwrite: Overwrite,
    },
    Add {
        archive: String,
        sources: Vec<String>,
        options: AddOptions,
    },
    Delete {
        archive: String,
        items: Vec<String>,
        password: Option<String>,
    },
    Test {
        archive: String,
        password: Option<String>,
    },
    /// Extract one entry to a temp folder and open it with the default app.
    Open {
        archive: String,
        item: String,
        password: Option<String>,
        #[serde(default)]
        launch: bool,
    },
    /// Extract entries to a temp folder for dragging out to Explorer.
    PrepareDrag {
        archive: String,
        items: Vec<String>,
        base: String,
        password: Option<String>,
    },
    /// Extract entries and put them on the OS clipboard as files, so they
    /// can be pasted (Ctrl+V) in Explorer / Finder.
    CopyToClipboard {
        archive: String,
        items: Vec<String>,
        base: String,
        password: Option<String>,
    },
}

/// Files copied to the clipboard must outlive this DaperZip window (the user
/// may paste after closing it), so they live outside the session folder.
fn clipboard_dir() -> PathBuf {
    std::env::temp_dir().join("daperzip-clipboard")
}

/// Remove clipboard copies older than a day.
fn clean_clipboard_dir() {
    let Ok(rd) = std::fs::read_dir(clipboard_dir()) else {
        return;
    };
    for e in rd.flatten() {
        let old = e
            .metadata()
            .and_then(|m| m.modified())
            .map(|t| t.elapsed().unwrap_or_default() > Duration::from_secs(24 * 3600))
            .unwrap_or(false);
        if old {
            let _ = std::fs::remove_dir_all(e.path());
        }
    }
}

fn set_clipboard_files(state: &AppState, paths: &[PathBuf]) -> Result<(), ErrorPayload> {
    use clipboard_rs::Clipboard;
    let files: Vec<String> = paths
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect();
    let mut guard = state.clipboard.lock().unwrap();
    if guard.is_none() {
        // kept alive: on Linux (X11) the clipboard is served by this process
        *guard = Some(
            clipboard_rs::ClipboardContext::new().map_err(|e| ErrorPayload::from(e.to_string()))?,
        );
    }
    guard
        .as_ref()
        .unwrap()
        .set_files(files)
        .map_err(|e| ErrorPayload::from(e.to_string()))
}

/// Files currently on the OS clipboard (copied in Explorer / Finder).
#[tauri::command]
fn clipboard_files(state: State<AppState>) -> Vec<String> {
    use clipboard_rs::Clipboard;
    let mut guard = state.clipboard.lock().unwrap();
    if guard.is_none() {
        *guard = clipboard_rs::ClipboardContext::new().ok();
    }
    guard
        .as_ref()
        .and_then(|c| c.get_files().ok())
        .unwrap_or_default()
        .into_iter()
        .map(|f| f.strip_prefix("file://").map(str::to_string).unwrap_or(f))
        .filter(|f| Path::new(f).exists())
        .collect()
}

fn session_subdir(state: &AppState) -> std::io::Result<PathBuf> {
    std::fs::create_dir_all(&state.session_dir)?;
    Ok(tempfile::Builder::new()
        .prefix("o")
        .tempdir_in(&state.session_dir)?
        .keep())
}

fn run_job(
    app: &AppHandle,
    window: &str,
    job: Job,
    progress: daperzip_core::Progress,
    cancel: &CancelToken,
) -> CmdResult<Value> {
    let state = app.state::<AppState>();
    let z = state.engine()?;
    let c = Some(cancel);
    match job {
        Job::Extract {
            archive,
            dest,
            items,
            base,
            password,
            overwrite,
        } => {
            let (z, eff, _) = state.reader(&archive)?;
            let archive = eff.to_string_lossy().into_owned();
            if items.is_empty() {
                z.extract(
                    Path::new(&archive),
                    Path::new(&dest),
                    &[],
                    password.as_deref(),
                    overwrite,
                    Some(progress),
                    c,
                )?;
            } else {
                z.extract_relative(
                    Path::new(&archive),
                    Path::new(&dest),
                    &items,
                    &base,
                    password.as_deref(),
                    overwrite,
                    Some(progress),
                    c,
                )?;
            }
            Ok(json!({ "dest": dest }))
        }
        Job::ExtractAuto {
            archive,
            mode,
            password,
            overwrite,
        } => {
            let ap = Path::new(&archive);
            let (z, eff, _) = state.reader(&archive)?;
            let parent = ap.parent().map(Path::to_path_buf).unwrap_or_default();
            let dest = match mode.as_str() {
                "here" => parent,
                "folder" => unique_path(&parent.join(archive_stem(&archive))),
                _ => {
                    let info = z.list(&eff, password.as_deref())?;
                    smart_extract_target(&info, ap).0
                }
            };
            z.extract(
                &eff,
                &dest,
                &[],
                password.as_deref(),
                overwrite,
                Some(progress),
                c,
            )?;
            Ok(json!({ "dest": dest }))
        }
        Job::Add {
            archive,
            sources,
            options,
        } => {
            let srcs: Vec<PathBuf> = sources.iter().map(PathBuf::from).collect();
            z.add(Path::new(&archive), &srcs, &options, Some(progress), c)?;
            Ok(json!({ "archive": archive }))
        }
        Job::Delete {
            archive,
            items,
            password,
        } => {
            z.delete(
                Path::new(&archive),
                &items,
                password.as_deref(),
                Some(progress),
                c,
            )?;
            Ok(Value::Null)
        }
        Job::Test { archive, password } => {
            let (z, eff, _) = state.reader(&archive)?;
            let out = z.test(&eff, password.as_deref(), Some(progress), c)?;
            Ok(json!({ "output": out }))
        }
        Job::Open {
            archive,
            item,
            password,
            launch,
        } => {
            let dir = session_subdir(&state)?;
            let parent = item
                .rsplit_once('/')
                .map(|(p, _)| p.to_string())
                .unwrap_or_default();
            let (z, eff, _) = state.reader(&archive)?;
            let made = z.extract_relative(
                &eff,
                &dir,
                std::slice::from_ref(&item),
                &parent,
                password.as_deref(),
                Overwrite::Overwrite,
                Some(progress),
                c,
            )?;
            let path = made
                .first()
                .cloned()
                .ok_or_else(|| ErrorPayload::from("파일을 풀지 못했습니다.".to_string()))?;
            if launch {
                tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|e| e.to_string())?;
                if state.settings.lock().unwrap().watch_opened_files && path.is_file() {
                    state.watched.lock().unwrap().push(Watched {
                        window: window.to_string(),
                        archive,
                        archive_dir: daperzip_core::names::nfc(&parent),
                        mtime: std::fs::metadata(&path).and_then(|m| m.modified()).ok(),
                        path: path.clone(),
                    });
                }
            }
            Ok(json!({ "path": path }))
        }
        Job::CopyToClipboard {
            archive,
            items,
            base,
            password,
        } => {
            clean_clipboard_dir();
            std::fs::create_dir_all(clipboard_dir())?;
            let dir = tempfile::Builder::new()
                .prefix("c")
                .tempdir_in(clipboard_dir())?
                .keep();
            let (z, eff, _) = state.reader(&archive)?;
            let made = z.extract_relative(
                &eff,
                &dir,
                &items,
                &base,
                password.as_deref(),
                Overwrite::Overwrite,
                Some(progress),
                c,
            )?;
            set_clipboard_files(&state, &made)?;
            Ok(json!({ "count": made.len() }))
        }
        Job::PrepareDrag {
            archive,
            items,
            base,
            password,
        } => {
            let dir = session_subdir(&state)?;
            let (z, eff, _) = state.reader(&archive)?;
            let made = z.extract_relative(
                &eff,
                &dir,
                &items,
                &base,
                password.as_deref(),
                Overwrite::Overwrite,
                Some(progress),
                c,
            )?;
            Ok(json!({ "paths": made }))
        }
    }
}

/// Start a background job. Progress arrives as `job-progress` events and
/// the result as a `job-done` event on the calling window.
#[tauri::command]
fn start_job(app: AppHandle, window: WebviewWindow, state: State<AppState>, job: Job) -> u64 {
    let id = state.id();
    let token = CancelToken::new();
    state.jobs.lock().unwrap().insert(id, token.clone());
    let label = window.label().to_string();
    std::thread::spawn(move || {
        let last = Mutex::new((Instant::now() - Duration::from_secs(1), 255u8));
        let app2 = app.clone();
        let label2 = label.clone();
        let progress = move |pct: u8, file: &str| {
            let mut l = last.lock().unwrap();
            if pct != l.1 || l.0.elapsed() > Duration::from_millis(120) {
                *l = (Instant::now(), pct);
                let _ = app2.emit_to(
                    label2.as_str(),
                    "job-progress",
                    json!({ "id": id, "percent": pct, "file": file }),
                );
            }
        };
        let result = run_job(&app, &label, job, &progress, &token);
        app.state::<AppState>().jobs.lock().unwrap().remove(&id);
        let payload = match result {
            Ok(v) => json!({ "id": id, "ok": true, "result": v }),
            Err(e) => json!({ "id": id, "ok": false, "error": e }),
        };
        let _ = app.emit_to(label.as_str(), "job-done", payload);
    });
    id
}

#[tauri::command]
fn cancel_job(state: State<AppState>, id: u64) {
    if let Some(t) = state.jobs.lock().unwrap().get(&id) {
        t.cancel();
    }
}

/// Start an OS drag-and-drop of already-extracted files (Windows).
#[tauri::command]
fn start_drag(app: AppHandle, window: WebviewWindow, paths: Vec<String>) -> CmdResult<()> {
    let files: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    app.run_on_main_thread(move || {
        let image = drag::Image::Raw(include_bytes!("../icons/32x32.png").to_vec());
        #[cfg(target_os = "linux")]
        let target = match window.gtk_window() {
            Ok(w) => w,
            Err(_) => return,
        };
        #[cfg(target_os = "linux")]
        let target = &target;
        #[cfg(not(target_os = "linux"))]
        let target = &window;
        let _ = drag::start_drag(
            target,
            drag::DragItem::Files(files),
            image,
            |_, _| {},
            drag::Options::default(),
        );
    })
    .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(())
}

/// Stop watching a file that was opened from an archive.
#[tauri::command]
fn unwatch(state: State<AppState>, path: String) {
    state
        .watched
        .lock()
        .unwrap()
        .retain(|w| w.path != Path::new(&path));
}

fn watch_loop(app: AppHandle) {
    loop {
        std::thread::sleep(Duration::from_millis(1500));
        let state = app.state::<AppState>();
        let mut changed = Vec::new();
        {
            let mut list = state.watched.lock().unwrap();
            list.retain(|w| app.get_webview_window(&w.window).is_some() && w.path.exists());
            for w in list.iter_mut() {
                let m = std::fs::metadata(&w.path).and_then(|m| m.modified()).ok();
                if m.is_some() && m != w.mtime {
                    w.mtime = m;
                    changed.push((
                        w.window.clone(),
                        json!({
                            "archive": w.archive,
                            "archiveDir": w.archive_dir,
                            "path": w.path,
                            "name": w.path.file_name().map(|n| n.to_string_lossy().into_owned()),
                        }),
                    ));
                }
            }
        }
        for (win, payload) in changed {
            let _ = app.emit_to(win.as_str(), "opened-file-changed", payload);
        }
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() {
    let argv: Vec<String> = std::env::args().collect();
    // Used by the installer / uninstaller (and CI). No window is shown.
    //   --register-shell[=user|machine]   default: follows the install location
    //   --unregister-shell                removes both scopes (machine needs admin)
    if let Some(arg) = argv.get(1) {
        if let Some(rest) = arg.strip_prefix("--register-shell") {
            let scope = match rest {
                "=user" => shell::Scope::User,
                "=machine" => shell::Scope::Machine,
                _ => shell::install_scope(),
            };
            let ok = shell::register_menu(true, scope)
                .or_else(|_| shell::register_menu(true, shell::Scope::User))
                .is_ok();
            std::process::exit(if ok { 0 } else { 1 });
        }
        if arg == "--unregister-shell" {
            let _ = shell::unregister_menu(shell::Scope::Machine);
            let _ = shell::unregister_menu(shell::Scope::User);
            let _ = shell::unregister_assoc();
            return;
        }
    }

    let session_dir = std::env::temp_dir().join(format!("daperzip-session-{}", std::process::id()));
    let session_for_setup = session_dir.clone();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let (action, paths) = parse_args(&argv, Path::new(&cwd));
            handle_invocation(app, action, paths);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let handle = app.handle().clone();
            let config_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("DaperZip"));
            let settings_path = config_dir.join("settings.json");
            let mut extra = Vec::new();
            if let Ok(r) = app.path().resource_dir() {
                extra.push(r.join("7zip"));
            }
            if let Some(d) = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(Path::to_path_buf))
            {
                extra.push(d.join("7zip"));
                extra.push(d);
            }
            // Development runs (`cargo run`): use the 7-Zip committed in vendor/.
            if cfg!(debug_assertions) {
                let platform = if cfg!(windows) {
                    "windows-x64"
                } else if cfg!(target_os = "macos") {
                    "macos"
                } else {
                    "linux-x64"
                };
                extra.push(
                    Path::new(env!("CARGO_MANIFEST_DIR"))
                        .join("../vendor/7zip")
                        .join(platform),
                );
            }
            app.manage(AppState {
                settings: Mutex::new(Settings::load(&settings_path)),
                settings_path,
                extra_7z_dirs: extra,
                window_args: Mutex::new(HashMap::new()),
                jobs: Mutex::new(HashMap::new()),
                next_id: AtomicU64::new(1),
                pending: Mutex::new(None),
                watched: Mutex::new(Vec::new()),
                clipboard: Mutex::new(None),
                session_dir: session_for_setup.clone(),
                resolved: Mutex::new(HashMap::new()),
                update_checked: std::sync::atomic::AtomicBool::new(false),
            });
            let cwd = std::env::current_dir().unwrap_or_default();
            let (action, paths) = parse_args(&argv, &cwd);
            // First run on Windows: add the Explorer menu for this user unless
            // the installer already did it (for everyone) or the user turned
            // it off in Settings.
            if cfg!(windows) {
                let state = handle.state::<AppState>();
                let (configured, ko) = {
                    let s = state.settings.lock().unwrap();
                    (s.shell_menu_configured, s.language != "en")
                };
                if !configured {
                    if shell::menu_scope().is_none() {
                        let _ = shell::register_menu(ko, shell::Scope::User);
                    }
                    state.settings.lock().unwrap().shell_menu_configured = true;
                    state.save_settings();
                }
            }
            handle_invocation(&handle, action, paths);
            let h2 = handle.clone();
            std::thread::spawn(move || watch_loop(h2));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_args,
            app_info,
            get_settings,
            set_settings,
            open_window,
            open_task_window,
            open_path,
            reveal_path,
            open_url,
            path_info,
            suggest_archive_path,
            archive_name,
            file_exists,
            set_shell_menu,
            sync_shell_language,
            check_update,
            skip_update,
            install_update,
            set_file_assoc,
            open_default_apps,
            list_archive,
            rename_entry,
            start_job,
            cancel_job,
            start_drag,
            clipboard_files,
            unwatch,
        ])
        .build(tauri::generate_context!())
        .expect("failed to start DaperZip");

    let session = Arc::new(session_dir);
    app.run(move |_app, event| match event {
        RunEvent::Exit => {
            let _ = std::fs::remove_dir_all(session.as_path());
        }
        // macOS: files opened from Finder arrive as an event, not as argv.
        #[cfg(target_os = "macos")]
        RunEvent::Opened { urls } => {
            let paths: Vec<String> = urls
                .into_iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            handle_invocation(_app, String::new(), paths);
        }
        _ => {}
    });
}
