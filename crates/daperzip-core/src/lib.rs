//! DaperZip archive engine.
//!
//! DaperZip never implements compression itself. Every archive operation is
//! delegated to the official 7-Zip console program (`7z.exe` + `7z.dll` on
//! Windows, `7zz`/`7z` elsewhere). This crate finds that program, builds
//! command lines, parses its output and reports progress.

pub mod model;
pub mod names;
pub mod parse;
pub mod paths;

use std::ffi::OsString;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

pub use model::*;
pub use paths::*;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("7-Zip 실행 파일을 찾을 수 없습니다.")]
    NotFound,
    #[error("비밀번호가 필요합니다.")]
    PasswordRequired,
    #[error("비밀번호가 올바르지 않습니다.")]
    WrongPassword,
    #[error("작업이 취소되었습니다.")]
    Cancelled,
    #[error("{message}")]
    SevenZip { message: String, output: String },
    #[error("{0}")]
    Io(#[from] std::io::Error),
}

impl Error {
    /// Machine-readable code for the UI.
    pub fn code(&self) -> &'static str {
        match self {
            Error::NotFound => "not_found",
            Error::PasswordRequired => "password_required",
            Error::WrongPassword => "wrong_password",
            Error::Cancelled => "cancelled",
            Error::SevenZip { .. } => "sevenzip",
            Error::Io(_) => "io",
        }
    }

    pub fn details(&self) -> &str {
        match self {
            Error::SevenZip { output, .. } => output,
            _ => "",
        }
    }
}

pub type Result<T> = std::result::Result<T, Error>;

/// Called with (percent 0..=100, current file name).
pub type Progress<'a> = &'a (dyn Fn(u8, &str) + Sync);

/// Shared cancellation flag. Clone it and call [`CancelToken::cancel`] from
/// any thread; the running 7-Zip process is killed promptly.
#[derive(Clone, Default)]
pub struct CancelToken(Arc<AtomicBool>);

impl CancelToken {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn cancel(&self) {
        self.0.store(true, Ordering::SeqCst)
    }
    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

/// Locate a 7-Zip console executable.
///
/// Search order: `$DAPERZIP_7Z`, `extra_dirs` (e.g. the bundled `7zip` folder),
/// `PATH`, and on Windows `Program Files\7-Zip`.
pub fn find_7zip(extra_dirs: &[PathBuf]) -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("DAPERZIP_7Z").map(PathBuf::from) {
        if p.is_file() {
            return Some(p);
        }
    }
    let names: &[&str] = if cfg!(windows) {
        &["7z.exe", "7za.exe"]
    } else {
        &["7zz", "7z", "7za"]
    };
    for d in extra_dirs {
        for n in names {
            let p = d.join(n);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    if let Some(path) = std::env::var_os("PATH") {
        for d in std::env::split_paths(&path) {
            for n in names {
                let p = d.join(n);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    if cfg!(windows) {
        for var in ["ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"] {
            if let Some(base) = std::env::var_os(var) {
                let p = PathBuf::from(base).join("7-Zip").join("7z.exe");
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    None
}

/// Paths inside archives are `/`-separated; 7-Zip on Windows wants `\`.
fn native(p: &str) -> String {
    if cfg!(windows) {
        p.replace('/', "\\")
    } else {
        p.to_string()
    }
}

struct Output {
    code: i32,
    stdout: String,
    stderr: String,
}

/// Handle to the 7-Zip program.
#[derive(Clone, Debug)]
pub struct SevenZip {
    pub exe: PathBuf,
    /// Code page for file names in legacy ZIPs ("949" = Korean). Empty = auto.
    /// Only effective with the Windows build of 7-Zip.
    pub codepage: String,
    /// Convert macOS-style decomposed (NFD) names to NFC when extracting
    /// and when creating archives.
    pub normalize_names: bool,
    /// Skip macOS metadata (__MACOSX, .DS_Store) when extracting.
    pub skip_mac_junk: bool,
}

const MAC_JUNK_EXTRACT: &[&str] = &["-xr!__MACOSX", "-xr!.DS_Store"];
const MAC_JUNK_ADD: &[&str] = &["-xr!__MACOSX", "-xr!.DS_Store", "-xr!._*"];

impl SevenZip {
    pub fn new(exe: PathBuf) -> Self {
        SevenZip {
            exe,
            codepage: String::new(),
            normalize_names: true,
            skip_mac_junk: true,
        }
    }

    pub fn locate(extra_dirs: &[PathBuf]) -> Result<Self> {
        find_7zip(extra_dirs).map(Self::new).ok_or(Error::NotFound)
    }

    fn run(
        &self,
        args: Vec<OsString>,
        cwd: Option<&Path>,
        progress: Option<Progress>,
        cancel: Option<&CancelToken>,
    ) -> Result<Output> {
        let mut cmd = Command::new(&self.exe);
        cmd.args(&args).arg("-scsUTF-8");
        // 7-Zip for macOS/Linux always prints UTF-8; on Windows ask for it.
        if cfg!(windows) {
            cmd.arg("-sccUTF-8");
        }
        if progress.is_some() {
            cmd.arg("-bsp1");
        }
        if let Some(d) = cwd {
            cmd.current_dir(d);
        }
        // stdin is closed so 7-Zip can never block on an interactive prompt.
        cmd.stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let mut child = cmd.spawn()?;
        let mut stdout = child.stdout.take().unwrap();
        let mut stderr = child.stderr.take().unwrap();

        let (out, err, status) = std::thread::scope(|s| -> Result<(Vec<u8>, Vec<u8>, i32)> {
            let err_h = s.spawn(move || {
                let mut v = Vec::new();
                let _ = stderr.read_to_end(&mut v);
                v
            });
            let out_h = s.spawn(move || {
                let mut all = Vec::new();
                let mut pending: Vec<u8> = Vec::new();
                let mut buf = [0u8; 8192];
                let mut last: Option<(u8, String)> = None;
                loop {
                    let n = match stdout.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => n,
                    };
                    all.extend_from_slice(&buf[..n]);
                    if let Some(cb) = progress {
                        pending.extend_from_slice(&buf[..n]);
                        // fragments are separated by backspaces / CR / LF
                        let mut start = 0;
                        for i in 0..pending.len() {
                            if matches!(pending[i], b'\x08' | b'\r' | b'\n') {
                                if i > start {
                                    let frag = String::from_utf8_lossy(&pending[start..i]);
                                    if let Some(p) = parse::parse_progress(&frag) {
                                        if last.as_ref() != Some(&p) {
                                            cb(p.0, &p.1);
                                            last = Some(p);
                                        }
                                    }
                                }
                                start = i + 1;
                            }
                        }
                        pending.drain(..start);
                    }
                }
                all
            });

            let status = loop {
                if let Some(st) = child.try_wait()? {
                    break st;
                }
                if cancel.map(|c| c.is_cancelled()).unwrap_or(false) {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = out_h.join();
                    let _ = err_h.join();
                    return Err(Error::Cancelled);
                }
                std::thread::sleep(Duration::from_millis(30));
            };
            Ok((
                out_h.join().unwrap_or_default(),
                err_h.join().unwrap_or_default(),
                status.code().unwrap_or(-1),
            ))
        })?;

        Ok(Output {
            code: status,
            stdout: String::from_utf8_lossy(&out).into_owned(),
            stderr: String::from_utf8_lossy(&err).into_owned(),
        })
    }

    fn check(&self, o: &Output, had_password: bool) -> Result<()> {
        let text = format!("{}\n{}", o.stderr, o.stdout);
        if text.contains("Enter password") {
            return Err(if had_password {
                Error::WrongPassword
            } else {
                Error::PasswordRequired
            });
        }
        if text.contains("Wrong password") || text.contains("Cannot open encrypted archive") {
            return Err(if had_password {
                Error::WrongPassword
            } else {
                Error::PasswordRequired
            });
        }
        if o.code >= 2 || (o.code == 1 && text.contains("ERROR")) {
            let message = parse::first_error(&text)
                .unwrap_or_else(|| format!("7-Zip 오류 (코드 {})", o.code));
            return Err(Error::SevenZip {
                message,
                output: text,
            });
        }
        Ok(())
    }

    fn common(&self, password: Option<&str>, archive: &Path) -> Vec<OsString> {
        let mut v: Vec<OsString> = Vec::new();
        if let Some(p) = password {
            v.push(format!("-p{p}").into());
        }
        let is_zip = archive.to_string_lossy().to_lowercase().ends_with(".zip");
        if !self.codepage.is_empty() && is_zip {
            v.push(format!("-mcp={}", self.codepage).into());
        }
        v
    }

    /// 7-Zip version string, e.g. "24.09".
    pub fn version(&self) -> Result<String> {
        let o = self.run(vec!["i".into()], None, None, None)?;
        let first = o.stdout.lines().find(|l| l.contains("7-Zip")).unwrap_or("");
        Ok(first
            .split_whitespace()
            .find(|w| {
                w.chars()
                    .next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
                    && w.contains('.')
            })
            .unwrap_or("?")
            .to_string())
    }

    /// List the contents of an archive.
    pub fn list(&self, archive: &Path, password: Option<&str>) -> Result<ArchiveInfo> {
        let mut args: Vec<OsString> = vec!["l".into(), "-slt".into(), archive.into()];
        args.extend(self.common(password, archive));
        let o = self.run(args, None, None, None)?;
        self.check(&o, password.is_some())?;
        let info = parse::parse_slt(&archive.to_string_lossy(), &o.stdout);
        if info.kind.is_empty() && info.entries.is_empty() {
            return Err(Error::SevenZip {
                message: "압축 파일이 아니거나 지원하지 않는 형식입니다.".into(),
                output: format!("{}\n{}", o.stderr, o.stdout),
            });
        }
        Ok(info)
    }

    /// Extract the whole archive (or `items`, keeping their full paths) to `dest`.
    #[allow(clippy::too_many_arguments)]
    pub fn extract(
        &self,
        archive: &Path,
        dest: &Path,
        items: &[String],
        password: Option<&str>,
        overwrite: Overwrite,
        progress: Option<Progress>,
        cancel: Option<&CancelToken>,
    ) -> Result<()> {
        fs::create_dir_all(dest)?;
        let mut args: Vec<OsString> = vec!["x".into(), archive.into()];
        let mut o = OsString::from("-o");
        o.push(dest);
        args.push(o);
        args.push(overwrite.switch().into());
        args.push("-y".into());
        args.push("-spd".into());
        if self.skip_mac_junk {
            args.extend(MAC_JUNK_EXTRACT.iter().map(OsString::from));
        }
        args.extend(self.common(password, archive));
        let list = if items.is_empty() {
            None
        } else {
            Some(write_listfile(items)?)
        };
        if let Some(l) = &list {
            let mut a = OsString::from("@");
            a.push(l.as_os_str());
            args.push(a);
        }
        let out = self.run(args, None, progress, cancel)?;
        self.check(&out, password.is_some())?;
        if self.normalize_names {
            self.normalize_extracted(archive, dest, items, password);
        }
        Ok(())
    }

    /// Rename extracted NFD names (made on macOS) to NFC.
    fn normalize_extracted(
        &self,
        archive: &Path,
        dest: &Path,
        items: &[String],
        password: Option<&str>,
    ) {
        let Ok(info) = self.list(archive, password) else {
            return;
        };
        let mut tops: Vec<String> = info
            .entries
            .iter()
            .filter(|e| e.raw != e.path)
            .filter(|e| {
                items.is_empty()
                    || items.iter().any(|i| {
                        e.raw == *i
                            || e.raw.starts_with(&format!("{i}/"))
                            || i.starts_with(&format!("{}/", e.raw))
                    })
            })
            .map(|e| e.raw.split('/').next().unwrap_or("").to_string())
            .collect();
        tops.sort();
        tops.dedup();
        for top in tops {
            let p = dest.join(&top);
            if p.exists() {
                names::normalize_tree(&p);
            } else {
                let fixed = dest.join(names::nfc(&top));
                if fixed.exists() {
                    names::normalize_tree(&fixed);
                }
            }
        }
    }

    /// Extract `items` (full archive paths) so they land in `dest` relative to
    /// archive folder `base`: items=["docs/sub"], base="docs" → `dest/sub/…`.
    /// Returns the top-level paths created in `dest`.
    #[allow(clippy::too_many_arguments)]
    pub fn extract_relative(
        &self,
        archive: &Path,
        dest: &Path,
        items: &[String],
        base: &str,
        password: Option<&str>,
        overwrite: Overwrite,
        progress: Option<Progress>,
        cancel: Option<&CancelToken>,
    ) -> Result<Vec<PathBuf>> {
        fs::create_dir_all(dest)?;
        let base_nfc = names::nfc(base.trim_matches('/'));
        let base = base_nfc.as_str();
        // Extract into a hidden temp dir on the same volume, then move into place.
        let tmp = tempfile::Builder::new()
            .prefix(".daperzip-")
            .tempdir_in(dest)?;
        self.extract(
            archive,
            tmp.path(),
            items,
            password,
            Overwrite::Overwrite,
            progress,
            cancel,
        )?;
        let mut src_root = tmp.path().to_path_buf();
        if !base.is_empty() {
            for part in base.split('/') {
                src_root.push(part);
            }
        }
        let mut created = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for item in items {
            // the temp tree has NFC names now; compare in NFC
            let item_nfc = names::nfc(item);
            let item = &item_nfc;
            let rel = if base.is_empty() {
                item.as_str()
            } else {
                item.strip_prefix(base)
                    .map(|r| r.trim_start_matches('/'))
                    .unwrap_or(item)
            };
            let top = rel.split('/').next().unwrap_or(rel).to_string();
            if top.is_empty() || !seen.insert(top.clone()) {
                continue;
            }
            let src = src_root.join(&top);
            if !src.exists() && fs::symlink_metadata(&src).is_err() {
                continue;
            }
            let mut target = dest.join(&top);
            if target.exists() {
                match overwrite {
                    Overwrite::Skip => continue,
                    Overwrite::Rename => target = unique_path(&target),
                    Overwrite::Overwrite => {
                        if target.is_dir() && src.is_dir() {
                            merge_dirs(&src, &target)?;
                            created.push(target);
                            continue;
                        }
                        if target.is_dir() {
                            fs::remove_dir_all(&target)?;
                        } else {
                            fs::remove_file(&target)?;
                        }
                    }
                }
            }
            move_path(&src, &target)?;
            created.push(target);
        }
        Ok(created)
    }

    /// Test archive integrity.
    pub fn test(
        &self,
        archive: &Path,
        password: Option<&str>,
        progress: Option<Progress>,
        cancel: Option<&CancelToken>,
    ) -> Result<String> {
        let mut args: Vec<OsString> = vec!["t".into(), archive.into()];
        args.extend(self.common(password, archive));
        let o = self.run(args, None, progress, cancel)?;
        self.check(&o, password.is_some())?;
        Ok(o.stdout)
    }

    /// Create `archive` or add `sources` to it.
    pub fn add(
        &self,
        archive: &Path,
        sources: &[PathBuf],
        opts: &AddOptions,
        progress: Option<Progress>,
        cancel: Option<&CancelToken>,
    ) -> Result<()> {
        if sources.is_empty() {
            return Err(Error::SevenZip {
                message: "압축할 파일이 없습니다.".into(),
                output: String::new(),
            });
        }
        let archive = absolute(archive);
        let sources: Vec<PathBuf> = sources.iter().map(|s| absolute(s)).collect();
        let fmt = opts
            .format
            .or_else(|| Format::from_path(&archive.to_string_lossy()));
        if let Some(f) = fmt.filter(|f| f.is_compressed_tar()) {
            return self.add_compressed_tar(&archive, &sources, f, opts, progress, cancel);
        }

        // Group sources by parent dir so stored paths are relative names.
        let staging;
        let groups: Vec<(PathBuf, Vec<String>)> = if opts.archive_dir.trim_matches('/').is_empty() {
            let mut g: Vec<(PathBuf, Vec<String>)> = Vec::new();
            for s in &sources {
                let parent = s.parent().unwrap_or(Path::new("/")).to_path_buf();
                let name = s
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default();
                match g.iter_mut().find(|(p, _)| *p == parent) {
                    Some((_, v)) => v.push(name),
                    None => g.push((parent, vec![name])),
                }
            }
            g
        } else {
            // Place files inside a folder of the archive: copy into a staging tree.
            staging = tempfile::Builder::new()
                .prefix("daperzip-stage-")
                .tempdir()?;
            let sub = opts.archive_dir.trim_matches('/');
            let mut target = staging.path().to_path_buf();
            for part in sub.split('/') {
                target.push(part);
            }
            fs::create_dir_all(&target)?;
            for s in &sources {
                copy_path(s, &target.join(s.file_name().unwrap_or_default()))?;
            }
            vec![(
                staging.path().to_path_buf(),
                vec![sub.split('/').next().unwrap().to_string()],
            )]
        };

        let is_7z = fmt == Some(Format::SevenZ);
        let is_zip = fmt == Some(Format::Zip);
        for (i, (cwd, names)) in groups.iter().enumerate() {
            let mut args: Vec<OsString> = vec!["a".into(), archive.clone().into()];
            if let Some(f) = opts.format {
                args.push(format!("-t{}", f.switch()).into());
            }
            args.push(format!("-mx={}", opts.level.min(9)).into());
            args.push("-y".into());
            // -spd (no wildcards) is only needed for names containing * or ?;
            // without it the "._*" exclusion below can match.
            if names.iter().any(|n| n.contains(['*', '?'])) {
                args.push("-spd".into());
            }
            if opts.exclude_mac_junk {
                args.extend(MAC_JUNK_ADD.iter().map(OsString::from));
            }
            if opts.threads > 0 {
                args.push(format!("-mmt={}", opts.threads).into());
            }
            if let Some(pw) = opts.password.as_deref().filter(|p| !p.is_empty()) {
                args.push(format!("-p{pw}").into());
                if is_7z && opts.encrypt_names {
                    args.push("-mhe=on".into());
                }
                if is_zip && opts.zip_aes {
                    args.push("-mem=AES256".into());
                }
            }
            if i == 0 && !opts.volume_size.is_empty() {
                args.push(format!("-v{}", opts.volume_size).into());
            }
            if is_zip && !self.codepage.is_empty() {
                args.push(format!("-mcp={}", self.codepage).into());
            }
            let list = write_listfile(names)?;
            let mut a = OsString::from("@");
            a.push(list.as_os_str());
            args.push(a);
            let o = self.run(args, Some(cwd), progress, cancel)?;
            self.check(&o, opts.password.is_some())?;
        }
        // Store composed (NFC) names so archives made on a Mac look right on Windows.
        let renamable = matches!(
            fmt,
            Some(Format::Zip | Format::SevenZ | Format::Tar | Format::Wim)
        );
        if self.normalize_names
            && renamable
            && opts.volume_size.is_empty()
            && names::tree_has_non_nfc(&sources)
        {
            let pw = opts.password.as_deref().filter(|p| !p.is_empty());
            let info = self.list(&archive, pw)?;
            let pairs: Vec<(String, String)> = info
                .entries
                .iter()
                .filter(|e| !e.implicit && e.raw != e.path)
                .map(|e| (e.raw.clone(), e.path.clone()))
                .collect();
            // rename deepest paths first so parent renames don't invalidate children
            let mut pairs = pairs;
            pairs.sort_by_key(|(r, _)| std::cmp::Reverse(r.matches('/').count()));
            for chunk in pairs.chunks(200) {
                self.rename(&archive, chunk, pw)?;
            }
        }
        Ok(())
    }

    fn add_compressed_tar(
        &self,
        archive: &Path,
        sources: &[PathBuf],
        fmt: Format,
        opts: &AddOptions,
        progress: Option<Progress>,
        cancel: Option<&CancelToken>,
    ) -> Result<()> {
        let tmp = tempfile::Builder::new().prefix("daperzip-tar-").tempdir()?;
        let tar = tmp
            .path()
            .join(format!("{}.tar", archive_stem(&archive.to_string_lossy())));
        let p1 = |p: u8, n: &str| {
            if let Some(cb) = progress {
                cb(p / 2, n)
            }
        };
        let p2 = |p: u8, n: &str| {
            if let Some(cb) = progress {
                cb(50 + p / 2, n)
            }
        };
        let tar_opts = AddOptions {
            format: Some(Format::Tar),
            ..Default::default()
        };
        self.add(&tar, sources, &tar_opts, Some(&p1), cancel)?;
        if archive.exists() {
            fs::remove_file(archive)?;
        }
        let mut args: Vec<OsString> = vec![
            "a".into(),
            archive.into(),
            format!("-t{}", fmt.switch()).into(),
            format!("-mx={}", opts.level.min(9)).into(),
            "-y".into(),
        ];
        if !opts.volume_size.is_empty() {
            args.push(format!("-v{}", opts.volume_size).into());
        }
        args.push(tar.into());
        let o = self.run(args, None, Some(&p2), cancel)?;
        self.check(&o, false)
    }

    /// Delete items (full archive paths; folders include their contents).
    pub fn delete(
        &self,
        archive: &Path,
        items: &[String],
        password: Option<&str>,
        progress: Option<Progress>,
        cancel: Option<&CancelToken>,
    ) -> Result<()> {
        let list = write_listfile(items)?;
        let mut args: Vec<OsString> = vec!["d".into(), archive.into(), "-spd".into()];
        let mut a = OsString::from("@");
        a.push(list.as_os_str());
        args.push(a);
        args.extend(self.common(password, archive));
        let o = self.run(args, None, progress, cancel)?;
        self.check(&o, password.is_some())
    }

    /// Rename/move items inside the archive.
    pub fn rename(
        &self,
        archive: &Path,
        pairs: &[(String, String)],
        password: Option<&str>,
    ) -> Result<()> {
        let mut args: Vec<OsString> = vec!["rn".into(), archive.into(), "-spd".into()];
        args.extend(self.common(password, archive));
        for (old, new) in pairs {
            args.push(native(old).into());
            args.push(native(new).into());
        }
        let o = self.run(args, None, None, None)?;
        self.check(&o, password.is_some())
    }
}

fn absolute(p: &Path) -> PathBuf {
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|d| d.join(p))
            .unwrap_or_else(|_| p.to_path_buf())
    }
}

/// Write a 7-Zip list file and close it. On Windows 7-Zip cannot open a
/// file we still hold open, so return only the path (deleted on drop).
fn write_listfile(items: &[String]) -> Result<tempfile::TempPath> {
    let mut f = tempfile::Builder::new()
        .prefix("daperzip-list-")
        .suffix(".txt")
        .tempfile()?;
    for it in items {
        f.write_all(native(it).as_bytes())?;
        f.write_all(b"\n")?;
    }
    f.flush()?;
    Ok(f.into_temp_path())
}

fn move_path(src: &Path, dst: &Path) -> std::io::Result<()> {
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(_) => {
            copy_path(src, dst)?;
            if src.is_dir() {
                fs::remove_dir_all(src)
            } else {
                fs::remove_file(src)
            }
        }
    }
}

fn copy_path(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for e in fs::read_dir(src)? {
            let e = e?;
            copy_path(&e.path(), &dst.join(e.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(src, dst).map(|_| ())
    }
}

fn merge_dirs(src: &Path, dst: &Path) -> std::io::Result<()> {
    for e in fs::read_dir(src)? {
        let e = e?;
        let s = e.path();
        let t = dst.join(e.file_name());
        if s.is_dir() && t.is_dir() {
            merge_dirs(&s, &t)?;
        } else {
            if t.is_dir() {
                fs::remove_dir_all(&t)?;
            } else if t.exists() {
                fs::remove_file(&t)?;
            }
            move_path(&s, &t)?;
        }
    }
    Ok(())
}
