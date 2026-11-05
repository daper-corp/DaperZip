//! Update check against GitHub Releases.
//!
//! When online, DaperZip asks GitHub for the newest release. If it is newer
//! than the running version the UI asks the user whether to update. On
//! Windows the installer is downloaded and started; elsewhere the release
//! page is opened. Offline or on any error the check is silently skipped.
use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// "https://github.com/owner/repo" from Cargo.toml.
const REPO_URL: &str = env!("CARGO_PKG_REPOSITORY");

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub current: String,
    pub latest: String,
    pub prerelease: bool,
    /// Release page.
    pub url: String,
    pub notes: String,
    /// Installer for this platform, if the release has one.
    pub asset_url: Option<String>,
    pub asset_name: Option<String>,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    body: Option<String>,
    draft: bool,
    prerelease: bool,
    #[serde(default)]
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

fn agent(timeout: u64) -> ureq::Agent {
    let tls = ureq::tls::TlsConfig::builder()
        // use the OS certificate store (works behind corporate proxies)
        .root_certs(ureq::tls::RootCerts::PlatformVerifier)
        .build();
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(timeout)))
        .user_agent(format!("DaperZip/{}", env!("CARGO_PKG_VERSION")))
        .tls_config(tls)
        .build()
        .into()
}

fn api_url() -> Option<String> {
    let path = REPO_URL
        .trim_end_matches('/')
        .strip_prefix("https://github.com/")?;
    Some(format!(
        "https://api.github.com/repos/{path}/releases?per_page=20"
    ))
}

/// Parse "v1.2.3", "1.2.3-beta.2" → comparable key.
/// A pre-release sorts before the same version without a suffix.
pub fn version_key(v: &str) -> Option<(u64, u64, u64, bool, Vec<VersionPart>)> {
    let v = v.trim().trim_start_matches(['v', 'V']);
    let (core, pre) = match v.split_once('-') {
        Some((c, p)) => (c, Some(p)),
        None => (v, None),
    };
    let core = core.split('+').next()?;
    let mut it = core.split('.').map(|p| p.parse::<u64>());
    let major = it.next()?.ok()?;
    let minor = it.next().unwrap_or(Ok(0)).ok()?;
    let patch = it.next().unwrap_or(Ok(0)).ok()?;
    let pre_parts = pre
        .map(|p| {
            p.split('.')
                .map(|x| match x.parse::<u64>() {
                    Ok(n) => VersionPart::Num(n),
                    Err(_) => VersionPart::Text(x.to_lowercase()),
                })
                .collect()
        })
        .unwrap_or_default();
    Some((major, minor, patch, pre.is_none(), pre_parts))
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum VersionPart {
    Num(u64),
    Text(String),
}

pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (version_key(candidate), version_key(current)) {
        (Some(a), Some(b)) => a > b,
        _ => false,
    }
}

fn platform_asset(assets: &[Asset]) -> Option<&Asset> {
    let want: &[&str] = if cfg!(windows) {
        &["x64-setup.exe"]
    } else if cfg!(target_os = "macos") {
        &[".dmg"]
    } else {
        &[".AppImage", ".deb"]
    };
    want.iter()
        .find_map(|suffix| assets.iter().find(|a| a.name.ends_with(suffix)))
}

/// Ask GitHub for the newest release. `Ok(None)` = already up to date.
pub fn check() -> Result<Option<UpdateInfo>, String> {
    let url = api_url().ok_or("no repository URL")?;
    let body = agent(8)
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| e.to_string())?
        .body_mut()
        .read_to_string()
        .map_err(|e| e.to_string())?;
    let releases: Vec<Release> = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let current = env!("CARGO_PKG_VERSION");
    let best = releases
        .iter()
        .filter(|r| !r.draft && version_key(&r.tag_name).is_some())
        .max_by(|a, b| version_key(&a.tag_name).cmp(&version_key(&b.tag_name)));
    let Some(r) = best.filter(|r| is_newer(&r.tag_name, current)) else {
        return Ok(None);
    };
    let asset = platform_asset(&r.assets);
    Ok(Some(UpdateInfo {
        current: current.to_string(),
        latest: r.tag_name.trim_start_matches(['v', 'V']).to_string(),
        prerelease: r.prerelease,
        url: r.html_url.clone(),
        notes: r.body.clone().unwrap_or_default(),
        asset_url: asset.map(|a| a.browser_download_url.clone()),
        asset_name: asset.map(|a| a.name.clone()),
    }))
}

/// Download an installer into the temp folder and return its path.
pub fn download(url: &str, name: &str) -> Result<PathBuf, String> {
    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || "._-".contains(c) {
                c
            } else {
                '_'
            }
        })
        .collect();
    let dir = std::env::temp_dir().join("daperzip-update");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(safe);
    let mut resp = agent(300).get(url).call().map_err(|e| e.to_string())?;
    let mut reader = resp
        .body_mut()
        .with_config()
        .limit(512 * 1024 * 1024)
        .reader();
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    std::io::copy(&mut reader, &mut file).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions() {
        assert!(is_newer("v0.1.1", "0.1.0"));
        assert!(is_newer("0.2.0", "0.1.9"));
        assert!(is_newer("1.0.0", "1.0.0-beta.3"));
        assert!(is_newer("1.0.0-beta.10", "1.0.0-beta.9"));
        assert!(is_newer("0.1.0-rc.1", "0.1.0-beta.5"));
        assert!(!is_newer("v0.1.0", "0.1.0"));
        assert!(!is_newer("0.1.0-beta.1", "0.1.0"));
        assert!(!is_newer("nightly", "0.1.0"));
    }

    #[test]
    fn api_url_from_repo() {
        assert_eq!(
            api_url().unwrap(),
            "https://api.github.com/repos/daper-corp/DaperZip/releases?per_page=20"
        );
    }
}

#[cfg(test)]
mod live {
    /// `cargo test -p daperzip -- --ignored live_check` (needs internet)
    #[test]
    #[ignore]
    fn live_check() {
        println!("{:?}", super::check());
        assert!(super::check().is_ok());
    }
}
