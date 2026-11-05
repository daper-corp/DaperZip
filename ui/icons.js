// Original DaperZip icon set (MIT). All icons are inline SVG strings.
(function () {
  const A = "#2F6FED", G = "#19B394", W = "#F5A524", R = "#E5484D";
  const svg = (vb, body) => `<svg class="i" viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  const I = {
    app: svg(64, `<rect x="6" y="10" width="52" height="46" rx="10" fill="${A}"/><rect x="6" y="10" width="52" height="16" rx="10" fill="#6E96FF"/><rect x="6" y="20" width="52" height="6" fill="#6E96FF"/><rect x="28" y="10" width="8" height="32" fill="#fff"/><g fill="${A}"><rect x="28" y="13" width="4" height="3"/><rect x="32" y="18" width="4" height="3"/><rect x="28" y="23" width="4" height="3"/><rect x="32" y="28" width="4" height="3"/></g><rect x="25" y="37" width="14" height="12" rx="3" fill="${W}"/><circle cx="32" cy="43" r="2.4" fill="#fff"/>`),
    open: svg(32, `<path d="M3 8a2 2 0 0 1 2-2h7l3 3h12a2 2 0 0 1 2 2v3H3z" fill="${W}"/><path d="M3 12h26l-3 14H5a2 2 0 0 1-2-2z" fill="#FFC857"/>`),
    extract: svg(32, `<rect x="4" y="15" width="24" height="13" rx="3" fill="${A}"/><rect x="14" y="15" width="4" height="7" fill="#fff" opacity=".9"/><path d="M16 12V2m-5 5 5-5 5 5" stroke="${G}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    compress: svg(32, `<rect x="4" y="15" width="24" height="13" rx="3" fill="${A}"/><rect x="14" y="15" width="4" height="7" fill="#fff" opacity=".9"/><path d="M16 2v10m-5-5 5 5 5-5" stroke="${W}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    add: svg(32, `<path d="M7 3h12l6 6v20H7z" fill="#E8EEF9" stroke="#5A6478" stroke-width="1.5" stroke-linejoin="round"/><circle cx="22" cy="23" r="7" fill="${G}"/><path d="M22 19v8m-4-4h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`),
    delete: svg(32, `<path d="M8 9h16l-1.5 19h-13z" fill="${R}"/><rect x="5" y="6" width="22" height="3" rx="1.5" fill="${R}"/><rect x="12" y="3" width="8" height="3" rx="1" fill="${R}"/><path d="M13 13v11m6-11v11" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`),
    test: svg(32, `<path d="M16 3 27 7v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="${G}"/><path d="m11 16 4 4 7-8" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    view: svg(32, `<path d="M2 16s5-9 14-9 14 9 14 9-5 9-14 9S2 16 2 16z" fill="#E8EEF9" stroke="#5A6478" stroke-width="1.5"/><circle cx="16" cy="16" r="5" fill="${A}"/><circle cx="17.5" cy="14.5" r="1.6" fill="#fff"/>`),
    info: svg(32, `<circle cx="16" cy="16" r="13" fill="${A}"/><rect x="14.5" y="14" width="3" height="10" rx="1.5" fill="#fff"/><circle cx="16" cy="9.5" r="2" fill="#fff"/>`),
    settings: svg(32, `<g fill="#6B7385" transform="translate(16 16)"><rect x="-2.6" y="-14" width="5.2" height="28" rx="1.6"/><rect x="-2.6" y="-14" width="5.2" height="28" rx="1.6" transform="rotate(45)"/><rect x="-2.6" y="-14" width="5.2" height="28" rx="1.6" transform="rotate(90)"/><rect x="-2.6" y="-14" width="5.2" height="28" rx="1.6" transform="rotate(135)"/><circle r="9.5"/></g><circle cx="16" cy="16" r="4" fill="#fff"/>`),
    up: svg(24, `<path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    back: svg(24, `<path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    forward: svg(24, `<path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    copy: svg(32, `<rect x="10" y="9" width="16" height="19" rx="2.5" fill="#E8EEF9" stroke="#5A6478" stroke-width="1.6"/><path d="M7 22V6a2 2 0 0 1 2-2h11" stroke="#5A6478" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
    paste: svg(32, `<rect x="6" y="6" width="20" height="23" rx="3" fill="#FFC857"/><rect x="11" y="3" width="10" height="6" rx="2" fill="#5A6478"/><rect x="10" y="13" width="12" height="2" rx="1" fill="#fff"/><rect x="10" y="18" width="9" height="2" rx="1" fill="#fff"/>`),
    search: svg(24, `<circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),
    refresh: svg(24, `<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    lock: svg(32, `<rect x="6" y="14" width="20" height="15" rx="3" fill="${W}"/><path d="M10 14v-4a6 6 0 0 1 12 0v4" stroke="${W}" stroke-width="3" fill="none"/><circle cx="16" cy="21" r="2.4" fill="#fff"/>`),
    rename: svg(32, `<path d="M6 22 20 8l4 4-14 14H6z" fill="${A}"/><path d="m20 8 2-2a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-2 2" fill="${W}"/>`),
    error: svg(32, `<circle cx="16" cy="16" r="13" fill="${R}"/><path d="M16 9v9" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="22.5" r="1.8" fill="#fff"/>`),
    question: svg(32, `<circle cx="16" cy="16" r="13" fill="${A}"/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="16" cy="22.5" r="1.7" fill="#fff"/>`),
    ok: svg(32, `<circle cx="16" cy="16" r="13" fill="${G}"/><path d="m10 16 4 4 8-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    window: svg(32, `<rect x="4" y="6" width="24" height="20" rx="3" fill="#E8EEF9" stroke="#5A6478" stroke-width="1.5"/><rect x="4" y="6" width="24" height="5" rx="2" fill="${A}"/>`),
  };

  // ---- file type icons ----
  const folder = svg(32, `<path d="M3 8a2 2 0 0 1 2-2h7l3 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#FFC857"/><path d="M3 12h26v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="${W}"/>`);
  const doc = (color, mark = "") => svg(32, `<path d="M7 2h12l7 7v19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="${color}"/><path d="M19 2v5a2 2 0 0 0 2 2h5z" fill="#fff" opacity=".45"/>${mark}`);
  const line = (y) => `<rect x="9" y="${y}" width="12" height="2" rx="1" fill="#fff" opacity=".9"/>`;
  const TYPES = {
    folder,
    archive: doc(A, `<rect x="14" y="2" width="4" height="15" fill="#fff" opacity=".85"/><rect x="12.5" y="16" width="7" height="7" rx="1.5" fill="${W}"/>`),
    image: doc("#22A06B", `<circle cx="12" cy="15" r="2.5" fill="#fff"/><path d="m8 26 6-7 4 4 3-3 4 6z" fill="#fff" opacity=".9"/>`),
    video: doc("#8B5CF6", `<path d="M12 14v10l9-5z" fill="#fff"/>`),
    audio: doc("#EC4899", `<path d="M14 24a3 3 0 1 1-2-2.8V12l9-2v11a3 3 0 1 1-2-2.8V13l-5 1z" fill="#fff"/>`),
    pdf: doc("#E5484D", `<text x="15.5" y="24" font-size="8" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial">PDF</text>`),
    word: doc("#2B579A", `<text x="15.5" y="24" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial">W</text>`),
    excel: doc("#217346", `<text x="15.5" y="24" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial">X</text>`),
    ppt: doc("#D24726", `<text x="15.5" y="24" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial">P</text>`),
    hwp: doc("#1E9FD8", `<text x="15.5" y="24" font-size="9" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial">한</text>`),
    code: doc("#475569", `<path d="m12 15-3 4 3 4m8-8 3 4-3 4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    exe: doc("#0EA5E9", `<rect x="9" y="14" width="14" height="10" rx="1.5" fill="#fff"/><rect x="9" y="14" width="14" height="3" fill="#fff" opacity=".6"/>`),
    text: doc("#94A3B8", line(13) + line(17) + line(21)),
    file: doc("#A5B0C2", ""),
  };
  const EXT = {};
  const reg = (type, list) => list.split(" ").forEach((e) => (EXT[e] = type));
  reg("archive", "7z zip rar tar gz tgz bz2 tbz tbz2 xz txz zst lz lzma cab iso wim arj lzh lha z cpio rpm deb 001 zipx jar apk dmg alz egg");
  reg("image", "png jpg jpeg gif bmp webp svg ico tif tiff heic psd raw avif");
  reg("video", "mp4 mkv avi mov wmv webm flv m4v ts");
  reg("audio", "mp3 wav flac aac ogg m4a wma opus");
  reg("pdf", "pdf");
  reg("word", "doc docx rtf odt");
  reg("excel", "xls xlsx csv ods");
  reg("ppt", "ppt pptx odp key");
  reg("hwp", "hwp hwpx");
  reg("code", "js ts jsx tsx py rs c cpp h hpp cs java go rb php html htm css json xml yml yaml toml sh bat ps1 sql kt swift");
  reg("exe", "exe msi dll com scr appx");
  reg("text", "txt md log ini cfg conf nfo");

  window.ICONS = I;
  window.fileIcon = function (name, isDir) {
    if (isDir) return TYPES.folder;
    const i = name.lastIndexOf(".");
    const ext = i > 0 ? name.slice(i + 1).toLowerCase() : "";
    return TYPES[EXT[ext]] || TYPES.file;
  };
  window.fileTypeName = function (name, isDir) {
    if (isDir) return t("파일 폴더");
    const i = name.lastIndexOf(".");
    if (i <= 0) return t("파일");
    return name.slice(i + 1).toUpperCase() + (i18n.lang === "en" ? " File" : " 파일");
  };
  window.isArchiveName = function (name) {
    const n = name.toLowerCase();
    if (/\.(7z|zip|rar|tar)\.\d{3}$/.test(n) || /\.tar\.(gz|bz2|xz|zst)$/.test(n)) return true;
    const i = n.lastIndexOf(".");
    return i > 0 && EXT[n.slice(i + 1)] === "archive";
  };
})();
