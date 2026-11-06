// Generates the static pages in site/ (ko at /, en at /en/, plus privacy pages).
// Pages are committed as plain HTML (GitHub Pages serves site/ as is), so run this
// after editing the text below:  node scripts/build-site.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const BASE = "https://zip.dapercorp.com/";
const REPO = "https://github.com/daper-corp/DaperZip";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const L = {
  ko: {
    code: "ko", locale: "ko_KR", alt: "en_US", prefix: "", homeP: "", url: BASE, other: BASE + "en/",
    title: "DaperZip — Windows·macOS·Linux 무료 오픈소스 압축 프로그램 (7-Zip 엔진)",
    desc: "DaperZip은 Windows, macOS, Linux에서 쓰는 완전 무료 오픈소스 압축 프로그램입니다. ZIP, 7Z, RAR 등 대부분의 형식을 지원하고 한글 파일 이름 깨짐을 자동으로 바로잡습니다.",
    ogDesc: "완전 무료 오픈소스 압축 프로그램. Windows · macOS · Linux, 7-Zip 엔진.",
    img: BASE + "assets/og-ko.png", imgAlt: "DaperZip 압축 프로그램 화면", shot: "screenshot-ko.png", suffix: "",
    nav: ["기능", "화면", "다운로드", "설치 안내", "FAQ"], skip: "본문으로 건너뛰기",
    free: "완전 무료 · 오픈소스", beta: "베타",
    h1: "압축 파일을 쉽고 빠르게",
    lead: "DaperZip은 Windows · macOS · Linux에서 쓰는 압축 프로그램입니다. 압축 처리는 7-Zip 엔진이 담당합니다. 광고도, 가입도, 결제도 없습니다.",
    dl: "다운로드", other: "다른 운영체제",
    featuresT: "기능",
    features: [
      ["대부분의 압축 형식", "ZIP, 7Z, RAR, TAR, GZ, XZ, ISO, CAB, WIM, LZH 등 7-Zip이 읽는 형식을 열고 풉니다."],
      ["스마트 풀기", "항목이 하나면 그 자리에, 여러 개면 압축 파일 이름의 폴더를 만들어 풉니다."],
      ["탐색기 오른쪽 클릭", "Windows 탐색기에서 바로 풀고 압축합니다. 여러 파일을 골라도 한 번에 처리합니다."],
      ["한글 파일 이름 그대로", "Mac에서 만든 압축 파일의 자모 분리, 옛 Windows(CP949) ZIP의 깨진 이름을 자동으로 바로잡습니다."],
      ["비밀번호와 분할 압축", "ZIP AES-256, 7Z 파일 이름 암호화, CD · 4GB 단위 분할 압축을 지원합니다."],
      ["압축 파일 바로 편집", "파일 추가 · 삭제 · 이름 바꾸기, 끌어다 놓기, 압축 파일 안의 파일을 열어 고치면 다시 반영합니다."],
    ],
    galleryT: "화면",
    gallery: [
      ["cp949", "옛 Windows(CP949) ZIP의 깨진 한글 이름을 자동으로 바로잡습니다."],
      ["mac", "Mac에서 만든 압축 파일의 자모 분리를 정상 이름으로 고칩니다."],
      ["compress", "비밀번호, AES-256, 분할 압축을 한 화면에서 설정합니다."],
      ["settings", "언어, 테마, 7-Zip 경로, 파일 이름 호환 옵션을 고를 수 있습니다."],
    ],
    downloadT: "다운로드", allVer: "이전 버전과 변경 내역",
    installT: "설치 안내",
    install: {
      win: ['설치 프로그램에서 "나만 사용"(관리자 권한 불필요) 또는 "모든 사용자"를 고를 수 있습니다. 설치하면 탐색기 오른쪽 클릭 메뉴가 추가됩니다. Windows 11에서는 "추가 옵션 표시" 안에 있습니다.',
        '현재 코드 서명이 없어 "Windows의 PC 보호" 창이 나올 수 있습니다. "추가 정보" → "실행"을 누르세요. 소스는 모두 공개돼 있고 릴리스는 GitHub Actions에서 빌드되며, 릴리스 페이지의 SHA256SUMS로 파일을 검증할 수 있습니다.'],
      mac: ["dmg를 열고 DaperZip을 응용 프로그램 폴더로 끌어 놓으세요.", '처음 실행할 때 경고가 나오면 Finder에서 DaperZip을 오른쪽 클릭 → "열기"를 누르세요.'],
      linux: ["Debian · Ubuntu 계열은 .deb를 설치하세요. 그 밖의 배포판은 AppImage에 실행 권한을 주고 실행합니다."],
    },
    faqT: "자주 묻는 질문",
    faq: [
      ["정말 무료인가요?", "네. DaperZip은 완전 무료이고 MIT 라이선스 오픈소스입니다. 소스 코드는 GitHub에서 누구나 볼 수 있습니다."],
      ["7-Zip과 무엇이 다른가요?", "압축 처리는 7-Zip 엔진이 담당하고, DaperZip은 그 위에 한글 파일 이름 자동 복구, 스마트 풀기, 압축 파일 안에서 바로 편집, 탐색기 오른쪽 클릭 메뉴 같은 사용 편의 기능을 얹은 별개의 프로젝트입니다."],
      ["RAR 파일도 풀 수 있나요?", "네, RAR을 열고 풀 수 있습니다. 다만 RAR 형식으로 새로 압축하는 기능은 없습니다. 새로 만들 때는 ZIP, 7Z, TAR 계열, WIM을 고를 수 있습니다."],
      ["압축 파일의 한글 이름이 깨져요.", "DaperZip은 Mac에서 만든 압축 파일의 자모 분리와 옛 Windows(CP949) ZIP의 깨진 이름을 자동으로 감지해 고칩니다. 설정에서 ZIP 파일 이름 인코딩을 직접 고를 수도 있습니다."],
      ["설치할 때 경고가 나와요.", "현재 코드 서명이 없어서 Windows와 macOS가 처음 실행할 때 경고를 보여 줍니다. 위 설치 안내의 방법으로 실행할 수 있습니다. 릴리스에는 파일 검증용 SHA256SUMS가 함께 올라갑니다."],
      ["개인정보를 수집하나요?", "아니요. 압축과 해제는 모두 내 컴퓨터에서 처리되고, 파일이나 사용 정보는 어디로도 전송되지 않습니다. 시작할 때 새 버전이 있는지 GitHub에 확인하며, 설정에서 끌 수 있습니다. 자세한 내용은 개인정보 안내를 참고하세요."],
      ["어떤 운영체제를 지원하나요?", "Windows 10 / 11(x64), macOS 10.15 이상(Apple Silicon · Intel), Linux x64(deb · AppImage)를 지원합니다."],
    ],
    foot: { license: "DaperZip은 MIT 라이선스 오픈소스입니다.", privacy: "개인정보 안내", terms: "Daper 이용약관", seven: "압축 엔진: 7-Zip (Igor Pavlov, GNU LGPL + unRAR 제한). DaperZip은 7-Zip과 별개의 프로젝트입니다." },
    banner: null,
    langLabel: "EN", langAria: "English", langHref: "en/", langHl: "en",
  },
  en: {
    code: "en", locale: "en_US", alt: "ko_KR", prefix: "../", homeP: "", url: BASE + "en/", other: BASE,
    title: "DaperZip — Free, Open-Source Zip & 7z File Archiver for Windows, macOS, Linux",
    desc: "DaperZip is a completely free, open-source file archiver for Windows, macOS and Linux. Open ZIP, 7Z, RAR and more with the 7-Zip engine, with automatic fixes for garbled Korean file names.",
    ogDesc: "Free, open-source file archiver for Windows, macOS and Linux, powered by the 7-Zip engine.",
    img: BASE + "assets/og-en.png", imgAlt: "DaperZip file archiver window", shot: "screenshot-en.png", suffix: "-en",
    nav: ["Features", "Screenshots", "Download", "Install", "FAQ"], skip: "Skip to content",
    free: "Completely free · Open source", beta: "Beta",
    h1: "Archives, made easy",
    lead: "DaperZip is a file archiver for Windows, macOS and Linux. Compression is handled by the 7-Zip engine. No ads, no sign-up, no payments.",
    dl: "Download", other: "Other platforms",
    featuresT: "Features",
    features: [
      ["Most archive formats", "Open and extract ZIP, 7Z, RAR, TAR, GZ, XZ, ISO, CAB, WIM, LZH and everything else 7-Zip reads."],
      ["Smart extract", "One item goes right next to the archive; several items get a folder named after it."],
      ["Explorer right-click menu", "Extract and compress right from Windows Explorer. Multi-selection becomes one job."],
      ["File names stay intact", "Fixes decomposed names from macOS archives and legacy Windows code-page (CP949) ZIPs automatically."],
      ["Passwords and split volumes", "ZIP AES-256, encrypted 7Z file names, split archives (CD, 4 GB and more)."],
      ["Edit archives in place", "Add, delete, rename, drag and drop. Edit a file inside an archive and save it back."],
    ],
    galleryT: "Screenshots",
    gallery: [
      ["cp949", "Garbled Korean names in legacy Windows (CP949) ZIPs are fixed automatically."],
      ["mac", "Decomposed Hangul from archives made on a Mac becomes normal file names."],
      ["compress", "Set a password, AES-256 and split volumes in one window."],
      ["settings", "Choose language, theme, the 7-Zip path and file name compatibility options."],
    ],
    downloadT: "Download", allVer: "Older versions and release notes",
    installT: "Installation",
    install: {
      win: ['The installer lets you install for yourself (no admin rights) or for all users. It adds the Explorer right-click menu; on Windows 11 it is under "Show more options".',
        'The installer is not code-signed yet, so "Windows protected your PC" may appear. Click "More info" → "Run anyway". The source is fully public, releases are built by GitHub Actions, and you can verify files with SHA256SUMS on the release page.'],
      mac: ["Open the dmg and drag DaperZip to Applications.", 'If macOS warns on first launch, right-click DaperZip in Finder and choose "Open".'],
      linux: ["Install the .deb on Debian/Ubuntu. On other distributions make the AppImage executable and run it."],
    },
    faqT: "FAQ",
    faq: [
      ["Is it really free?", "Yes. DaperZip is completely free and open source under the MIT license. Anyone can read the source code on GitHub."],
      ["How is it different from 7-Zip?", "Compression is done by the 7-Zip engine. DaperZip is a separate project that adds convenience on top: automatic fixes for Korean file names, smart extract, editing inside archives and an Explorer right-click menu."],
      ["Can it open RAR files?", "Yes, it can open and extract RAR. It cannot create new RAR archives; for new archives you can choose ZIP, 7Z, TAR variants or WIM."],
      ["Korean file names in my archive look garbled.", "DaperZip detects decomposed Hangul from macOS archives and legacy Windows (CP949) ZIP names and fixes them automatically. You can also pick the ZIP file name encoding in Settings."],
      ["I get a warning when installing.", "The installers are not code-signed yet, so Windows and macOS show a warning on first launch. Follow the installation steps above. Releases include SHA256SUMS so you can verify the files."],
      ["Does it collect any data?", "No. Compression and extraction happen on your computer, and no files or usage data are sent anywhere. On start it checks GitHub for a newer version, which you can turn off in Settings. See the privacy notice for details."],
      ["Which systems are supported?", "Windows 10 / 11 (x64), macOS 10.15 or later (Apple Silicon and Intel), and Linux x64 (deb and AppImage)."],
    ],
    foot: { license: "DaperZip is open source under the MIT license.", privacy: "Privacy notice", terms: "Daper terms of service", seven: "Compression engine: 7-Zip by Igor Pavlov (GNU LGPL + unRAR restriction). DaperZip is a separate project from 7-Zip." },
    banner: null,
    langLabel: "한국어", langAria: "한국어", langHref: "../", langHl: "ko",
  },
};

const ld = (o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/^/gm, "  ")}\n  </script>\n`;

function head(l, { title, desc, url, other, withApp, faq, noindexAlt }) {
  const t = L[l];
  const ko = l === "ko";
  const koUrl = ko ? url : other, enUrl = ko ? other : url;
  let h = `  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="ko" href="${koUrl}">
  <link rel="alternate" hreflang="en" href="${enUrl}">
  <link rel="alternate" hreflang="x-default" href="${koUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="DaperZip">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${t.img}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(t.imgAlt)}">
  <meta property="og:url" content="${url}">
  <meta property="og:locale" content="${t.locale}">
  <meta property="og:locale:alternate" content="${t.alt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${t.img}">
  <meta name="theme-color" content="#0a0a0a">
`;
  if (withApp) h += ld({
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DaperZip",
    applicationCategory: "UtilitiesApplication", operatingSystem: "Windows, macOS, Linux",
    description: t.desc, url, inLanguage: l, downloadUrl: REPO + "/releases/latest",
    license: "https://opensource.org/licenses/MIT", isAccessibleForFree: true, image: t.img,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "Daper", url: "https://dapercorp.com" },
  });
  if (faq) h += ld({
    "@context": "https://schema.org", "@type": "FAQPage", inLanguage: l,
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  });
  const p = t.prefix;
  h += `  <link rel="icon" href="${p}favicon.ico?v=3" sizes="48x48">
  <link rel="icon" type="image/png" sizes="32x32" href="${p}assets/favicon-32.png?v=3">
  <link rel="icon" type="image/png" sizes="16x16" href="${p}assets/favicon-16.png?v=3">
  <link rel="apple-touch-icon" href="${p}assets/apple-touch-icon.png?v=3">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="${p}style.css">
`;
  return h;
}

function header(l, { home }) {
  const t = L[l], p = t.prefix;
  const hash = home ? "" : t.homeP;
  const n = t.nav;
  const link = (id, label) => `<a href="${hash}#${id}">${label}</a>`;
  return `  <a class="skip" href="#main">${t.skip}</a>
  <header class="top">
    <div class="wrap top-row">
      <a class="brand" href="${home ? "#" : t.homeP}"><span class="logo" role="img" aria-label="Daper"></span><span>DaperZip</span></a>
      <nav aria-label="Main">
        ${link("features", n[0])}
        ${link("screens", n[1])}
        ${link("download", n[2])}
        ${link("install", n[3])}
        ${link("faq", n[4])}
        <a href="${REPO}">GitHub</a>
        <a id="lang" class="lang" href="${home ? t.langHref : (l === "ko" ? "../en/privacy/" : "../../privacy/")}" hreflang="${t.langHl}" lang="${t.langHl}" aria-label="${t.langAria}">${t.langLabel}</a>
      </nav>
    </div>
  </header>
`;
}

function footer(l, { privacyHref }) {
  const t = L[l], f = t.foot;
  return `  <footer class="wrap foot">
    <p><span>${f.license}</span> <a href="${REPO}">GitHub</a> · <a href="${privacyHref}">${f.privacy}</a> · <a href="https://dapercorp.com/terms">${f.terms}</a> · <a href="https://dapercorp.com">Daper</a></p>
    <p class="muted small">${f.seven}</p>
  </footer>
`;
}

function home(l) {
  const t = L[l], p = t.prefix;
  const os = (n, d) => `          <div class="platform" data-os="${n}">\n            <h3>${n === "mac" ? "macOS" : n[0].toUpperCase() + n.slice(1)}</h3><p class="muted">${d}</p><ul></ul>\n          </div>\n`;
  const ko = l === "ko";
  const feats = t.features.map(([a, b]) => `        <article><h3>${a}</h3><p>${b}</p></article>`).join("\n");
  const gal = t.gallery.map(([k, c]) => `        <figure><img src="${p}assets/shot-${k}${t.suffix}.png" alt="${esc(c)}" width="1040" height="680" loading="lazy"><figcaption>${c}</figcaption></figure>`).join("\n");
  const faq = t.faq.map(([q, a]) => `        <details><summary>${q}</summary><p>${a}</p></details>`).join("\n");
  const i = t.install;
  return `<!doctype html>
<html lang="${l}">
<head>
${head(l, { title: t.title, desc: t.desc, url: t.url, other: t.other, withApp: true, faq: t.faq })}</head>
<body>
${header(l, { home: true })}  <div id="lang-banner" class="banner" hidden></div>

  <main id="main">
    <section class="hero">
      <div class="wrap hero-grid">
        <div class="hero-text">
          <p class="badges"><span class="badge free">${t.free}</span> <span class="badge" id="version-badge">${t.beta}</span></p>
          <h1>${t.h1}</h1>
          <p class="lead">${t.lead}</p>
          <div class="cta">
            <a id="primary-dl" class="btn primary" href="${REPO}/releases/latest">
              <span id="primary-label">${t.dl}</span>
              <small id="primary-meta"></small>
            </a>
            <a class="btn ghost" href="#download">${t.other}</a>
          </div>
          <p class="fine" id="primary-note"></p>
        </div>
        <figure class="shot">
          <img id="hero-shot" src="${p}assets/${t.shot}" alt="${esc(t.imgAlt)}" width="1040" height="680">
        </figure>
      </div>
    </section>

    <section id="features" class="wrap section">
      <h2>${t.featuresT}</h2>
      <div class="features">
${feats}
      </div>
    </section>

    <section id="screens" class="section alt">
      <div class="wrap">
        <h2>${t.galleryT}</h2>
        <div class="gallery">
${gal}
        </div>
      </div>
    </section>

    <section id="download" class="wrap section">
      <h2>${t.downloadT}</h2>
      <p class="muted" id="release-line"></p>
      <div class="platforms" id="platforms">
${os("windows", "Windows 10 / 11 · x64")}${os("mac", "10.15+ · Apple Silicon / Intel")}${os("linux", "x64 · deb / AppImage")}      </div>
      <p class="muted small"><a href="${REPO}/releases">${t.allVer}</a></p>
    </section>

    <section id="install" class="section alt">
      <div class="wrap">
        <h2>${t.installT}</h2>
        <div class="install">
          <article>
            <h3>Windows</h3>
            <p>${i.win[0]}</p>
            <p>${i.win[1]}</p>
          </article>
          <article>
            <h3>macOS</h3>
            <p>${i.mac[0]}</p>
            <p>${i.mac[1]}</p>
          </article>
          <article>
            <h3>Linux</h3>
            <p>${i.linux[0]}</p>
            <pre><code>chmod +x DaperZip_*.AppImage</code></pre>
          </article>
        </div>
      </div>
    </section>

    <section id="faq" class="wrap section">
      <h2>${t.faqT}</h2>
      <div class="faq">
${faq}
      </div>
    </section>
  </main>

${footer(l, { privacyHref: "privacy/" })}
  <script src="${p}app.js"></script>
</body>
</html>
`;
}

const PRIV = {
  ko: {
    title: "개인정보 안내 — DaperZip", desc: "DaperZip 앱과 웹사이트가 어떤 정보를 다루는지 안내합니다. DaperZip은 개인정보를 수집하지 않습니다.",
    h1: "개인정보 안내", updated: "최종 수정: 2026-11-05",
    secs: [
      ["요약", "DaperZip은 개인정보를 수집하지 않습니다. 압축과 해제는 모두 내 컴퓨터에서 처리되며, 파일이나 사용 정보는 Daper를 포함한 어디로도 전송되지 않습니다."],
      ["앱", "언어, 테마, 최근 연 파일 같은 설정은 내 컴퓨터의 설정 파일에만 저장됩니다. 시작할 때 새 버전이 있는지 확인하기 위해 GitHub(api.github.com)에 요청을 보냅니다. 이때 IP 주소 같은 일반적인 접속 정보가 GitHub에 전달되며, 이는 GitHub의 개인정보 처리방침을 따릅니다. 이 기능은 설정의 \"시작할 때 새 버전 확인\"에서 끌 수 있습니다."],
      ["웹사이트", "이 사이트는 쿠키와 방문 분석 도구를 쓰지 않습니다. 사이트는 GitHub Pages로 제공되어 GitHub가 접속 기록을 처리할 수 있고, 글꼴(Pretendard)은 jsDelivr CDN에서, 다운로드 목록은 GitHub에서 불러옵니다. 영어 안내 배너를 닫았는지는 브라우저의 localStorage에만 저장되며 서버로 전송되지 않습니다."],
      ["라이선스와 이용", "DaperZip은 MIT 라이선스로 제공되는 무료 오픈소스 소프트웨어이며, 라이선스에 따라 \"있는 그대로\" 제공됩니다. 별도의 서비스 계약이나 회원 가입은 없습니다. 운영 회사 Daper의 이용약관과 개인정보처리방침은 아래 링크에서 볼 수 있습니다."],
      ["문의", "개인정보나 이 안내에 관한 문의는 info@dapercorp.com 으로 보내 주세요."],
    ],
    links: [["Daper 개인정보처리방침", "https://dapercorp.com/privacy-policy"], ["Daper 이용약관", "https://dapercorp.com/terms"], ["GitHub 개인정보 처리방침", "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement"]],
    back: "← DaperZip 홈",
  },
  en: {
    title: "Privacy notice — DaperZip", desc: "What the DaperZip app and website do with your data. DaperZip does not collect personal information.",
    h1: "Privacy notice", updated: "Last updated: 2026-11-05",
    secs: [
      ["Summary", "DaperZip does not collect personal information. Compression and extraction happen on your computer, and no files or usage data are sent anywhere, including to Daper."],
      ["The app", "Settings such as language, theme and recent files are stored only in a settings file on your computer. On start the app asks GitHub (api.github.com) whether a newer version exists. GitHub receives ordinary connection data such as your IP address, governed by GitHub's privacy statement. You can turn this off with \"Check for updates on start\" in Settings."],
      ["The website", "This site uses no cookies and no analytics. It is served by GitHub Pages, which may process access logs; the font (Pretendard) is loaded from the jsDelivr CDN and the download list from GitHub. Whether you dismissed the language banner is stored only in your browser's localStorage and never sent to a server."],
      ["License and use", "DaperZip is free, open-source software under the MIT license and is provided \"as is\" under that license. There is no service agreement or account. The terms of service and privacy policy of the operating company, Daper, are linked below."],
      ["Contact", "Questions about privacy or this notice: info@dapercorp.com."],
    ],
    links: [["Daper privacy policy (Korean)", "https://dapercorp.com/privacy-policy"], ["Daper terms of service (Korean)", "https://dapercorp.com/terms"], ["GitHub privacy statement", "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement"]],
    back: "← DaperZip home",
  },
};

function privacy(l) {
  const t = L[l], q = PRIV[l];
  const url = (l === "ko" ? BASE : BASE + "en/") + "privacy/";
  const other = (l === "ko" ? BASE + "en/" : BASE) + "privacy/";
  const p = l === "ko" ? "../" : "../../";
  const tt = { ...t, prefix: p, homeP: "../" };
  L[l] = tt;
  const html = `<!doctype html>
<html lang="${l}">
<head>
${head(l, { title: q.title, desc: q.desc, url, other })}</head>
<body>
${header(l, { home: false })}
  <main id="main" class="wrap legal">
    <p><a href="${l === "ko" ? "../" : "../"}">${q.back}</a></p>
    <h1>${q.h1}</h1>
    <p class="muted small">${q.updated}</p>
${q.secs.map(([h, b]) => `    <h2>${h}</h2>\n    <p>${b}</p>`).join("\n")}
    <ul class="links">
${q.links.map(([a, u]) => `      <li><a href="${u}">${a}</a></li>`).join("\n")}
    </ul>
  </main>

${footer(l, { privacyHref: "./" })}
</body>
</html>
`;
  L[l] = t;
  return html;
}

const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), s); };
write("index.html", home("ko"));
write("en/index.html", home("en"));
write("privacy/index.html", privacy("ko"));
write("en/privacy/index.html", privacy("en"));

const urls = [["", ""], ["en/", ""], ["privacy/", ""], ["en/privacy/", ""]];
const day = new Date().toISOString().slice(0, 10);
const alt = (u) => {
  const ko = u.replace(/^en\//, ""), en = "en/" + ko;
  return `    <xhtml:link rel="alternate" hreflang="ko" href="${BASE}${ko}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${BASE}${en}"/>`;
};
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(([u]) => `  <url>\n    <loc>${BASE}${u}</loc>\n    <lastmod>${day}</lastmod>\n${alt(u)}\n  </url>`).join("\n")}
</urlset>
`);
