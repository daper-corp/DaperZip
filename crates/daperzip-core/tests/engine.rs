//! Integration tests against a real 7-Zip binary. Skipped if none is installed.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use daperzip_core::*;

fn sz() -> Option<SevenZip> {
    match SevenZip::locate(&[]) {
        Ok(s) => Some(s),
        Err(_) => {
            eprintln!("7-Zip not installed; skipping");
            None
        }
    }
}

fn fixture(dir: &Path) -> PathBuf {
    let src = dir.join("src");
    fs::create_dir_all(src.join("docs/sub")).unwrap();
    fs::write(src.join("a.txt"), "hello").unwrap();
    fs::write(src.join("docs/b.txt"), "bee").unwrap();
    fs::write(src.join("docs/sub/c.txt"), "sea").unwrap();
    fs::write(src.join("한글 [1].txt"), "korean").unwrap();
    src
}

fn sources(src: &Path) -> Vec<PathBuf> {
    vec![
        src.join("a.txt"),
        src.join("docs"),
        src.join("한글 [1].txt"),
    ]
}

fn paths(info: &ArchiveInfo) -> Vec<String> {
    info.entries.iter().map(|e| e.path.clone()).collect()
}

#[test]
fn create_list_extract_zip() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    let src = fixture(t.path());
    let arc = t.path().join("out.zip");
    let seen = Mutex::new(Vec::new());
    let cb = |p: u8, _: &str| seen.lock().unwrap().push(p);
    z.add(
        &arc,
        &sources(&src),
        &AddOptions::default(),
        Some(&cb),
        None,
    )
    .unwrap();

    let info = z.list(&arc, None).unwrap();
    assert_eq!(info.kind, "zip");
    assert!(info.writable);
    assert_eq!(
        paths(&info),
        [
            "a.txt",
            "docs",
            "docs/b.txt",
            "docs/sub",
            "docs/sub/c.txt",
            "한글 [1].txt"
        ]
    );
    assert_eq!(info.file_count(), 4);

    let out = t.path().join("x");
    z.extract(&arc, &out, &[], None, Overwrite::Overwrite, None, None)
        .unwrap();
    assert_eq!(
        fs::read_to_string(out.join("한글 [1].txt")).unwrap(),
        "korean"
    );
    assert_eq!(
        fs::read_to_string(out.join("docs/sub/c.txt")).unwrap(),
        "sea"
    );
}

#[test]
fn extract_relative_and_overwrite_modes() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    let src = fixture(t.path());
    let arc = t.path().join("out.7z");
    z.add(&arc, &sources(&src), &AddOptions::default(), None, None)
        .unwrap();

    let dest = t.path().join("rel");
    let items = vec!["docs/sub".to_string(), "docs/b.txt".to_string()];
    let made = z
        .extract_relative(
            &arc,
            &dest,
            &items,
            "docs",
            None,
            Overwrite::Rename,
            None,
            None,
        )
        .unwrap();
    assert_eq!(made, [dest.join("sub"), dest.join("b.txt")]);
    assert_eq!(fs::read_to_string(dest.join("sub/c.txt")).unwrap(), "sea");
    // no leftover temp dir
    assert_eq!(fs::read_dir(&dest).unwrap().count(), 2);

    // again with Rename → "b (2).txt"
    let made = z
        .extract_relative(
            &arc,
            &dest,
            &["docs/b.txt".into()],
            "docs",
            None,
            Overwrite::Rename,
            None,
            None,
        )
        .unwrap();
    assert_eq!(made, [dest.join("b (2).txt")]);
    // Skip → nothing
    let made = z
        .extract_relative(
            &arc,
            &dest,
            &["docs/b.txt".into()],
            "docs",
            None,
            Overwrite::Skip,
            None,
            None,
        )
        .unwrap();
    assert!(made.is_empty());
}

#[test]
fn passwords() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    let src = fixture(t.path());

    // 7z with encrypted file names: listing needs the password.
    let arc = t.path().join("secret.7z");
    let opts = AddOptions {
        password: Some("비밀123".into()),
        encrypt_names: true,
        ..Default::default()
    };
    z.add(&arc, &sources(&src), &opts, None, None).unwrap();
    assert!(matches!(z.list(&arc, None), Err(Error::PasswordRequired)));
    assert!(matches!(
        z.list(&arc, Some("nope")),
        Err(Error::WrongPassword)
    ));
    let info = z.list(&arc, Some("비밀123")).unwrap();
    assert!(info.has_encrypted());

    // AES zip: listing works, extraction needs the password.
    let arc = t.path().join("secret.zip");
    let opts = AddOptions {
        password: Some("pw".into()),
        ..Default::default()
    };
    z.add(&arc, &sources(&src), &opts, None, None).unwrap();
    let info = z.list(&arc, None).unwrap();
    assert!(info.entries.iter().any(|e| e.encrypted));
    let out = t.path().join("o");
    assert!(matches!(
        z.extract(&arc, &out, &[], None, Overwrite::Overwrite, None, None),
        Err(Error::PasswordRequired)
    ));
    assert!(matches!(
        z.extract(
            &arc,
            &out,
            &[],
            Some("bad"),
            Overwrite::Overwrite,
            None,
            None
        ),
        Err(Error::WrongPassword)
    ));
    z.extract(
        &arc,
        &out,
        &[],
        Some("pw"),
        Overwrite::Overwrite,
        None,
        None,
    )
    .unwrap();
    assert_eq!(fs::read_to_string(out.join("a.txt")).unwrap(), "hello");
}

#[test]
fn modify_archive() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    let src = fixture(t.path());
    let arc = t.path().join("m.zip");
    z.add(
        &arc,
        &[src.join("a.txt")],
        &AddOptions::default(),
        None,
        None,
    )
    .unwrap();
    // add into a sub folder of the archive
    let opts = AddOptions {
        archive_dir: "in/deep".into(),
        ..Default::default()
    };
    z.add(&arc, &[src.join("docs")], &opts, None, None).unwrap();
    assert_eq!(
        paths(&z.list(&arc, None).unwrap()),
        [
            "a.txt",
            "in",
            "in/deep",
            "in/deep/docs",
            "in/deep/docs/b.txt",
            "in/deep/docs/sub",
            "in/deep/docs/sub/c.txt"
        ]
    );
    z.rename(&arc, &[("a.txt".into(), "renamed.txt".into())], None)
        .unwrap();
    z.delete(&arc, &["in/deep/docs/sub".into()], None, None, None)
        .unwrap();
    assert_eq!(
        paths(&z.list(&arc, None).unwrap()),
        [
            "in",
            "in/deep",
            "in/deep/docs",
            "in/deep/docs/b.txt",
            "renamed.txt"
        ]
    );
    z.test(&arc, None, None, None).unwrap();
}

#[test]
fn tar_gz_and_smart_target() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    let src = fixture(t.path());
    let arc = t.path().join("bundle.tar.gz");
    z.add(
        &arc,
        &[src.join("docs")],
        &AddOptions::default(),
        None,
        None,
    )
    .unwrap();
    let info = z.list(&arc, None).unwrap();
    assert_eq!(paths(&info), ["bundle.tar"]);
    assert!(!info.writable);

    // one top-level folder → extract next to archive
    let zip1 = t.path().join("one.zip");
    z.add(
        &zip1,
        &[src.join("docs")],
        &AddOptions::default(),
        None,
        None,
    )
    .unwrap();
    let (dest, new_folder) = smart_extract_target(&z.list(&zip1, None).unwrap(), &zip1);
    assert!(!new_folder);
    assert_eq!(dest, t.path().canonicalize().unwrap());

    // several top-level items → folder named after archive
    let zip2 = t.path().join("many.zip");
    z.add(&zip2, &sources(&src), &AddOptions::default(), None, None)
        .unwrap();
    let (dest, new_folder) = smart_extract_target(&z.list(&zip2, None).unwrap(), &zip2);
    assert!(new_folder);
    assert_eq!(dest.file_name().unwrap(), "many");
}

#[test]
fn cancel_and_errors() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    let junk = t.path().join("junk.zip");
    fs::write(&junk, b"this is not a zip").unwrap();
    let e = z.list(&junk, None).unwrap_err();
    assert_eq!(e.code(), "sevenzip");

    let src = fixture(t.path());
    let tok = CancelToken::new();
    tok.cancel();
    let r = z.add(
        &t.path().join("c.7z"),
        &sources(&src),
        &AddOptions::default(),
        None,
        Some(&tok),
    );
    assert!(matches!(r, Err(Error::Cancelled)));
    assert!(!z.version().unwrap().is_empty());
}

// ---------------------------------------------------------------------------
// Cross-platform file names (macOS NFD, legacy CP949 ZIPs, Mac metadata)
// ---------------------------------------------------------------------------

fn nfd(s: &str) -> String {
    use unicode_normalization_shim::nfd;
    nfd(s)
}

mod unicode_normalization_shim {
    // tiny NFD for Hangul syllables only (enough for these tests)
    pub fn nfd(s: &str) -> String {
        let mut out = String::new();
        for c in s.chars() {
            let u = c as u32;
            if (0xAC00..=0xD7A3).contains(&u) {
                let i = u - 0xAC00;
                out.push(char::from_u32(0x1100 + i / 588).unwrap());
                out.push(char::from_u32(0x1161 + (i % 588) / 28).unwrap());
                if i % 28 != 0 {
                    out.push(char::from_u32(0x11A7 + i % 28).unwrap());
                }
            } else {
                out.push(c);
            }
        }
        out
    }
}

#[test]
fn mac_nfd_archive_is_shown_and_extracted_as_nfc() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    // Build an archive with NFD names and Mac junk, like Finder's "Compress".
    let src = t.path().join("macsrc");
    let folder = src.join(nfd("한글폴더"));
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join(nfd("보고서.txt")), "nfd").unwrap();
    fs::create_dir_all(src.join("__MACOSX")).unwrap();
    fs::write(src.join("__MACOSX/._x"), "junk").unwrap();
    fs::write(src.join(".DS_Store"), "junk").unwrap();
    let arc = t.path().join("mac.zip");
    // raw engine: keep NFD + junk to simulate an archive made on a Mac
    let mut raw = z.clone();
    raw.normalize_names = false;
    let opts = AddOptions {
        exclude_mac_junk: false,
        ..Default::default()
    };
    raw.add(
        &arc,
        &[folder.clone(), src.join("__MACOSX"), src.join(".DS_Store")],
        &opts,
        None,
        None,
    )
    .unwrap();

    let info = z.list(&arc, None).unwrap();
    let file = info
        .entries
        .iter()
        .find(|e| e.path == "한글폴더/보고서.txt")
        .expect("NFC display path");
    assert_eq!(file.raw, nfd("한글폴더/보고서.txt"));

    // full extraction: NFC names, no Mac junk
    let out = t.path().join("out");
    z.extract(&arc, &out, &[], None, Overwrite::Overwrite, None, None)
        .unwrap();
    assert_eq!(
        fs::read_to_string(out.join("한글폴더").join("보고서.txt")).unwrap(),
        "nfd"
    );
    assert!(!out.join("__MACOSX").exists());
    assert!(!out.join(".DS_Store").exists());

    // selected extraction relative to the (NFC) current folder, using raw item names
    let out2 = t.path().join("out2");
    let made = z
        .extract_relative(
            &arc,
            &out2,
            &[file.raw.clone()],
            "한글폴더",
            None,
            Overwrite::Rename,
            None,
            None,
        )
        .unwrap();
    assert_eq!(made, [out2.join("보고서.txt")]);
}

#[test]
fn compressing_nfd_sources_stores_nfc_and_skips_junk() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    let folder = t.path().join(nfd("사진"));
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join(nfd("여행.jpg")), "jpg").unwrap();
    fs::write(folder.join(".DS_Store"), "junk").unwrap();
    fs::write(folder.join("._여행.jpg"), "junk").unwrap();
    for (name, fmt) in [
        ("a.zip", Format::Zip),
        ("a.7z", Format::SevenZ),
        ("a.tar.gz", Format::Tgz),
    ] {
        let arc = t.path().join(name);
        let opts = AddOptions {
            format: Some(fmt),
            ..Default::default()
        };
        z.add(&arc, &[folder.clone()], &opts, None, None).unwrap();
        let mut check = z.clone();
        check.normalize_names = false;
        let mut target = arc.clone();
        if fmt == Format::Tgz {
            let x = t.path().join("tgz-x");
            check
                .extract(&arc, &x, &[], None, Overwrite::Overwrite, None, None)
                .unwrap();
            target = x.join("a.tar");
        }
        let raws: Vec<String> = check
            .list(&target, None)
            .unwrap()
            .entries
            .iter()
            .map(|e| e.raw.clone())
            .collect();
        assert_eq!(raws, ["사진", "사진/여행.jpg"], "{name}");
    }
}

#[test]
fn legacy_cp949_zip_is_detected_and_transcoded() {
    let Some(z) = sz() else { return };
    let t = tempfile::tempdir().unwrap();
    // Make a ZIP with ASCII placeholder names, then patch in CP949 bytes
    // (same length) to mimic a ZIP made by an old Korean Windows tool.
    let src = t.path().join("s");
    fs::create_dir_all(src.join("efgh")).unwrap();
    fs::write(src.join("abcd.txt"), "one").unwrap();
    fs::write(src.join("efgh/ijkl.txt"), "two").unwrap();
    let arc = t.path().join("legacy.zip");
    z.add(
        &arc,
        &[src.join("abcd.txt"), src.join("efgh")],
        &AddOptions::default(),
        None,
        None,
    )
    .unwrap();
    let mut bytes = fs::read(&arc).unwrap();
    let cp949 = |s: &str| encoding_rs::EUC_KR.encode(s).0.into_owned();
    for (from, to) in [("abcd", "한글"), ("efgh", "폴더"), ("ijkl", "문서")] {
        let to = cp949(to);
        assert_eq!(to.len(), 4);
        let mut i = 0;
        while let Some(p) = bytes[i..].windows(4).position(|w| w == from.as_bytes()) {
            bytes[i + p..i + p + 4].copy_from_slice(&to);
            i += p + 4;
        }
    }
    fs::write(&arc, &bytes).unwrap();

    let legacy = names::detect_legacy_zip(&arc, "").expect("legacy zip detected");
    assert_eq!(legacy.codepage, "949");
    assert!(names::detect_legacy_zip(&t.path().join("legacy.zip"), "949").is_some());

    let fixed = t.path().join("fixed.zip");
    names::transcode_zip(&arc, &fixed, &legacy.codepage).unwrap();
    assert!(names::detect_legacy_zip(&fixed, "").is_none());
    let info = z.list(&fixed, None).unwrap();
    assert_eq!(paths(&info), ["폴더", "폴더/문서.txt", "한글.txt"]);
    let out = t.path().join("o");
    z.extract(&fixed, &out, &[], None, Overwrite::Overwrite, None, None)
        .unwrap();
    assert_eq!(
        fs::read_to_string(out.join("폴더/문서.txt")).unwrap(),
        "two"
    );

    // a normal UTF-8 zip is not "legacy"
    let normal = t.path().join("normal.zip");
    z.add(
        &normal,
        &[src.join("abcd.txt")],
        &AddOptions::default(),
        None,
        None,
    )
    .unwrap();
    assert!(names::detect_legacy_zip(&normal, "").is_none());
}
