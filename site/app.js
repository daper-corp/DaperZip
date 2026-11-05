// DaperZip site: latest release downloads from GitHub.
(function () {
  const REPO = "daper-corp/DaperZip";
  const RELEASES = `https://github.com/${REPO}/releases`;

  const EN = { "dl.loading": "Download" };
  const KO = { "dl.loading": "다운로드" };
  const T = {
    ko: { forOs: (os) => `${os}용 다운로드`, installer: "설치 프로그램", portable: "포터블 (압축만 풀면 실행)", dmg: "디스크 이미지 (.dmg)", deb: "Debian / Ubuntu (.deb)", appimage: "AppImage (모든 배포판)", released: (v, d) => `최신 버전 ${v} · ${d}`, pre: "베타", unavailable: "아직 파일이 없습니다. GitHub 릴리스 페이지에서 확인하세요.", mobile: "DaperZip은 PC용 프로그램입니다. 아래에서 운영체제별 파일을 받을 수 있습니다.", alsoPortable: "설치 없이 쓰려면", portableLink: "포터블 버전" },
    en: { forOs: (os) => `Download for ${os}`, installer: "Installer", portable: "Portable (unzip and run)", dmg: "Disk image (.dmg)", deb: "Debian / Ubuntu (.deb)", appimage: "AppImage (any distribution)", released: (v, d) => `Latest ${v} · ${d}`, pre: "Beta", unavailable: "No files yet. See the GitHub releases page.", mobile: "DaperZip is a desktop app. Pick your platform below.", alsoPortable: "No install needed:", portableLink: "portable version" },
  };

  // ---------------- language ----------------
  // Each language is its own static page (/ = ko, /en/ = en) so search engines
  // can index both. The page language comes from <html lang>.
  const lang = document.documentElement.lang === "en" ? "en" : "ko";
  // ---------------- platform ----------------
  function detectOS() {
    const ua = navigator.userAgent || "";
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (/Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/i.test(p) && !/Macintosh/i.test(ua) )) return "mobile";
    if (/Win/i.test(p) || /Windows/i.test(ua)) return "windows";
    if (/Mac/i.test(p) || /Mac OS X/i.test(ua)) return "mac";
    if (/Linux|X11|CrOS/i.test(p + ua)) return "linux";
    return "unknown";
  }
  const os = detectOS();

  // ---------------- releases ----------------
  let release = null;
  const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const findAsset = (re) => release && release.assets.find((a) => re.test(a.name));

  function files() {
    return {
      windows: [[/x64-setup\.exe$/i, "installer"], [/portable.*\.zip$/i, "portable"]],
      mac: [[/\.dmg$/i, "dmg"]],
      linux: [[/\.deb$/i, "deb"], [/\.AppImage$/i, "appimage"]],
    };
  }

  function render() {
    const tr = T[lang];
    const groups = files();
    // per-platform lists
    document.querySelectorAll(".platform").forEach((box) => {
      const key = box.dataset.os;
      box.classList.toggle("current", key === os);
      const ul = box.querySelector("ul");
      ul.innerHTML = "";
      const items = groups[key].map(([re, label]) => [findAsset(re), label]).filter(([a]) => a);
      if (!items.length) {
        const li = document.createElement("li");
        li.className = "placeholder";
        li.innerHTML = `<a href="${RELEASES}">${tr.unavailable}</a>`;
        ul.append(li);
      }
      for (const [a, label] of items) {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = a.browser_download_url;
        link.innerHTML = `<span>${tr[label]}</span><span>${fmtSize(a.size)}</span>`;
        li.append(link);
        ul.append(li);
      }
    });

    // hero button
    const btn = document.getElementById("primary-dl");
    const label = document.getElementById("primary-label");
    const meta = document.getElementById("primary-meta");
    const note = document.getElementById("primary-note");
    note.textContent = "";
    const names = { windows: "Windows", mac: "macOS", linux: "Linux" };
    const main = os in groups ? findAsset(groups[os][0][0]) : null;
    if (main) {
      btn.href = main.browser_download_url;
      label.textContent = tr.forOs(names[os]);
      meta.textContent = `${release.tag_name} · ${fmtSize(main.size)}`;
      if (os === "windows") {
        const portable = findAsset(groups.windows[1][0]);
        if (portable) note.innerHTML = `${tr.alsoPortable} <a href="${portable.browser_download_url}">${tr.portableLink}</a>`;
      }
    } else {
      btn.href = "#download";
      label.textContent = lang === "en" ? EN["dl.loading"] : KO["dl.loading"];
      meta.textContent = release ? release.tag_name : "";
      if (os === "mobile") note.textContent = tr.mobile;
    }

    // version line
    const line = document.getElementById("release-line");
    const badge = document.getElementById("version-badge");
    if (release) {
      const d = new Date(release.published_at).toLocaleDateString(lang === "en" ? "en-US" : "ko-KR", { year: "numeric", month: "long", day: "numeric" });
      line.innerHTML = `${tr.released(release.tag_name, d)} · <a href="${release.html_url}">${lang === "en" ? "Release notes" : "변경 내역"}</a>`;
      badge.hidden = !release.prerelease;
    }
  }

  async function load() {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) throw new Error(r.status);
      const list = (await r.json()).filter((x) => !x.draft && x.assets && x.assets.length);
      release = list[0] || null; // GitHub returns newest first
    } catch (_) {
      release = null; // offline or rate-limited: links fall back to the releases page
    }
    render();
  }

  load();

  // Offer the English page to English-speaking visitors (no automatic redirect: crawlers must see both).
  (function banner() {
    const el = document.getElementById("lang-banner");
    if (!el || lang !== "ko" || !location.pathname.replace(/index\.html$/, "").match(/^\/?$/)) return;
    if (/^ko\b/i.test(navigator.language || "") || !/^en\b/i.test(navigator.language || "")) return;
    try { if (localStorage.getItem("daperzip.banner") === "off") return; } catch (_) {}
    const a = document.createElement("a"); a.href = "en/"; a.textContent = "View in English";
    const x = document.createElement("button"); x.type = "button"; x.textContent = "\u2715"; x.setAttribute("aria-label", "Close");
    x.onclick = () => { el.hidden = true; try { localStorage.setItem("daperzip.banner", "off"); } catch (_) {} };
    el.append("This page is in Korean.", a, x); el.hidden = false;
  })();
})();
