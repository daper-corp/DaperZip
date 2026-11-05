// DaperZip main UI.
(async function () {
  const app = document.getElementById("app");
  const menuEl = document.getElementById("menu");
  let settings = await API.call("get_settings");
  i18n.set(settings.language);
  applyTheme(settings.theme);
  const args = (await API.call("window_args")) || { mode: "main", action: "", paths: [] };

  // Language / theme changed (in any window): redraw this window in place.
  API.win.listen("appearance-changed", () => {
    if (args.mode !== "main") return; // don't interrupt a running task window
    if (S.archive) {
      try { sessionStorage.setItem("daperzip.restore", JSON.stringify({ archive: S.archive, cwd: S.cwd })); } catch (_) {}
    }
    location.reload();
  });

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }

  async function saveSettings(patch) {
    settings = { ...settings, ...patch };
    await API.call("set_settings", { settings });
  }

  function reportError(title, e) {
    if (e && e.code === "cancelled") { toast(t("취소했습니다.")); return; }
    return Dialogs.error(title, e);
  }

  async function afterExtract(dest, openFolder) {
    const hist = [dest, ...(settings.extractHistory || []).filter((d) => d !== dest)].slice(0, 10);
    await saveSettings({ extractHistory: hist });
    if (openFolder) API.call("open_path", { path: dest }).catch(() => {});
  }

  // ===================================================================
  // Context menu
  // ===================================================================
  function showMenu(x, y, items) {
    menuEl.innerHTML = "";
    for (const it of items) {
      if (it === "-") { menuEl.append(h("hr")); continue; }
      if (!it) continue;
      menuEl.append(h("button", { disabled: it.disabled, onclick: () => { hideMenu(); it.run(); } },
        it.icon ? svgEl(it.icon) : h("span", { style: { width: "16px" } }), it.label, it.key ? h("kbd", null, it.key) : null));
    }
    menuEl.hidden = false;
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.min(x, innerWidth - r.width - 6) + "px";
    menuEl.style.top = Math.min(y, innerHeight - r.height - 6) + "px";
  }
  function hideMenu() { menuEl.hidden = true; }
  addEventListener("mousedown", (e) => { if (!menuEl.contains(e.target)) hideMenu(); });
  addEventListener("blur", hideMenu);
  addEventListener("contextmenu", (e) => e.preventDefault());

  // ===================================================================
  // Task windows (launched from Explorer's right-click menu)
  // ===================================================================
  if (args.mode === "task") return runTask(args);

  async function taskView(title, icon) {
    app.innerHTML = "";
    const bar = h("div");
    const wrap = h("div", { class: "progress indet" }, bar);
    const pct = h("b", null, "");
    const file = h("div", { class: "prog-file" }, t("준비 중..."));
    const label = h("span", null, title);
    const cancel = h("button", { class: "btn" }, t("취소"));
    app.append(h("div", { class: "task" },
      h("div", { class: "dlg-head" }, svgEl(icon), label, h("span", { class: "spacer" }), pct),
      wrap, file, h("div", { class: "dlg-foot", style: { padding: 0, marginTop: "auto" } }, cancel)));
    API.win.setTitle(`${title} - DaperZip`);
    let cancelFn;
    cancel.onclick = () => { cancel.disabled = true; cancelFn?.(); };
    return {
      setTitle(s) { label.textContent = s; },
      start(c) { cancelFn = c; cancel.disabled = false; wrap.classList.add("indet"); bar.style.width = "0"; pct.textContent = ""; },
      update(p, f) { wrap.classList.remove("indet"); bar.style.width = p + "%"; pct.textContent = p + "%"; if (f) file.textContent = f; },
      finish() {},
    };
  }

  async function runTask({ action, paths }) {
    const close = () => API.win.close();
    try {
      if (action.startsWith("extract-")) {
        let dest = null, overwrite = settings.extractOverwrite, openFolder = settings.extractOpenFolder;
        if (action === "extract-dialog") {
          const first = paths[0];
          const stem = await API.call("archive_name", { path: first });
          const opts = await Dialogs.extract({
            archiveName: paths.length > 1 ? `${baseName(first)} +${paths.length - 1}` : baseName(first),
            defaultDest: joinPath(dirName(first), stem), settings,
          });
          if (!opts) return close();
          ({ dest, overwrite, openFolder } = opts);
        }
        const view = await taskView(t("압축 푸는 중"), ICONS.extract);
        for (const archive of paths) {
          view.setTitle(`${t("압축 푸는 중")} — ${baseName(archive)}`);
          try {
            let target = dest;
            if (dest && paths.length > 1) target = joinPath(dest, await API.call("archive_name", { path: archive }));
            const job = target
              ? (pw) => API.runJob({ kind: "extract", archive, dest: target, password: pw, overwrite }, view)
              : (pw) => API.runJob({ kind: "extractAuto", archive, mode: action.slice(8), password: pw, overwrite }, view);
            const r = await API.withPassword(archive, job);
            await afterExtract(r.dest, openFolder);
          } catch (e) {
            await reportError(baseName(archive), e);
          }
        }
        return close();
      }
      if (action === "compress-zip" || action === "compress-7z") {
        const format = action === "compress-zip" ? "zip" : "7z";
        const archive = await API.call("suggest_archive_path", { sources: paths, format });
        const view = await taskView(`${t("압축하는 중")} — ${baseName(archive)}`, ICONS.compress);
        try {
          await API.runJob({ kind: "add", archive, sources: paths, options: { format, level: settings.compressLevel ?? 5 } }, view);
        } catch (e) { await reportError(t("작업 실패"), e); }
        return close();
      }
      if (action === "compress-dialog") {
        API.win.setTitle(`${t("새로 압축하기")} - DaperZip`);
        const r = await Dialogs.compress({ sources: paths, settings, container: app });
        if (!r) return close();
        await compressWith(paths, r, await taskView(`${t("압축하는 중")} — ${baseName(r.archive)}`, ICONS.compress));
        return close();
      }
      close();
    } catch (e) {
      await reportError(t("작업 실패"), e);
      close();
    }
  }

  async function compressWith(sources, r, view) {
    try {
      await API.runJob({ kind: "add", archive: r.archive, sources, options: r.options }, view || Dialogs.progress(t("압축하는 중")));
      await saveSettings({ compressFormat: r.options.format, compressLevel: r.options.level, compressOpenFolder: r.openFolder });
      if (r.openFolder) API.call("reveal_path", { path: r.archive }).catch(() => {});
      return true;
    } catch (e) {
      await reportError(t("작업 실패"), e);
      return false;
    }
  }

  // ===================================================================
  // Main window
  // ===================================================================
  const S = {
    archive: null, info: null, children: new Map(), byPath: new Map(), cwd: "", sel: new Set(), anchor: -1,
    sort: { key: "name", dir: 1 }, query: "", items: [], back: [], fwd: [], expanded: new Set([""]),
  };

  const COLS = [
    { key: "name", label: "이름", w: "minmax(220px, 1fr)" },
    { key: "size", label: "크기", w: "96px", num: true },
    { key: "packed", label: "압축 크기", w: "96px", num: true },
    { key: "modified", label: "수정한 날짜", w: "148px" },
    { key: "type", label: "종류", w: "110px" },
  ];
  const GRID = COLS.map((c) => c.w).join(" ");
  const ROW = 26;

  // ---- layout ----
  const tb = (icon, label, onclick, opts = {}) => {
    const b = h("button", { class: "tb", title: opts.title || label, onclick }, svgEl(icon), h("span", null, label), opts.caret ? h("span", { class: "caret" }, "▾") : null);
    return b;
  };
  const B = {
    open: tb(ICONS.open, t("열기"), () => pickAndOpen()),
    extract: tb(ICONS.extract, t("풀기"), (e) => extractMenu(e.currentTarget), { caret: true }),
    compress: tb(ICONS.compress, t("새로 압축"), () => pickAndCompress()),
    add: tb(ICONS.add, t("추가"), () => addFiles()),
    del: tb(ICONS.delete, t("삭제"), () => deleteSelected()),
    test: tb(ICONS.test, t("테스트"), () => testArchive()),
    view: tb(ICONS.view, t("보기"), () => openSelected()),
    info: tb(ICONS.info, t("정보"), () => S.info && Dialogs.info(S.info)),
    settings: tb(ICONS.settings, t("설정"), (e) => settingsMenu(e.currentTarget), { caret: true }),
  };
  const toolbar = h("div", { class: "toolbar" }, B.open, B.extract, B.compress, h("div", { class: "tb-sep" }), B.add, B.del, B.test, B.view, B.info, h("div", { class: "spacer" }), B.settings);

  const backBtn = h("button", { class: "icon-btn", title: t("뒤로"), onclick: () => goBack() }, svgEl(ICONS.back));
  const fwdBtn = h("button", { class: "icon-btn", title: t("앞으로"), onclick: () => goForward() }, svgEl(ICONS.forward));
  const upBtn = h("button", { class: "icon-btn", title: t("상위 폴더"), onclick: () => goUp() }, svgEl(ICONS.up));
  const crumbs = h("div", { class: "crumbs" });
  const search = h("input", { type: "search", class: "search", placeholder: t("검색"), oninput: () => { S.query = search.value.trim().toLowerCase(); refreshList(); } });
  const pathbar = h("div", { class: "pathbar" }, backBtn, fwdBtn, upBtn, crumbs, h("div", { class: "search-wrap" }, svgEl(ICONS.search), search));

  const tree = h("div", { class: "tree" });
  const splitter = h("div", { class: "splitter" });
  const head = h("div", { class: "list-head", style: { gridTemplateColumns: GRID } });
  const inner = h("div", { class: "list-inner" });
  const empty = h("div", { class: "empty-msg" });
  const scroll = h("div", { class: "list-scroll", tabindex: 0 }, inner);
  const list = h("div", { class: "list" }, head, scroll, empty);
  const body = h("div", { class: "body" }, tree, splitter, list);
  const status = h("div", { class: "statusbar" });
  const start = h("div", { class: "start" });
  const dropHint = h("div", { class: "drop-hint", hidden: true });
  app.append(toolbar, pathbar, body, start, status, dropHint);

  // column headers
  for (const c of COLS) {
    head.append(h("div", { class: c.num ? "num" : "", onclick: () => {
      S.sort = { key: c.key, dir: S.sort.key === c.key ? -S.sort.dir : 1 };
      refreshList();
    } }, t(c.label)));
  }

  // tree splitter
  splitter.addEventListener("mousedown", (e) => {
    const x0 = e.clientX, w0 = tree.offsetWidth;
    const mv = (ev) => (tree.style.width = Math.max(140, Math.min(innerWidth * 0.5, w0 + ev.clientX - x0)) + "px");
    const up = () => { removeEventListener("mousemove", mv); removeEventListener("mouseup", up); };
    addEventListener("mousemove", mv);
    addEventListener("mouseup", up);
  });

  // ---- start screen ----
  function renderStart() {
    start.innerHTML = "";
    const card = (icon, title, sub, fn) => h("div", { class: "card", onclick: fn }, svgEl(icon), h("b", null, title), h("small", null, sub));
    start.append(
      h("div", { class: "brand" }, h("span", { class: "logo", role: "img", "aria-label": "Daper" }), h("h1", null, "DaperZip")),
      h("div", { class: "cards" },
        card(ICONS.open, t("압축 파일 열기"), t("압축 파일을 고릅니다"), () => pickAndOpen()),
        card(ICONS.compress, t("새로 압축하기"), t("파일과 폴더를 압축합니다"), () => pickAndCompress()),
        card(ICONS.extract, t("압축 풀기"), t("압축 파일을 골라 바로 풉니다"), () => pickAndExtract())),
      h("div", { class: "dropzone" }, h("b", null, t("여기로 끌어다 놓으세요")), t("압축 파일을 놓으면 열고, 다른 파일을 놓으면 새로 압축합니다.")),
    );
    const recent = (settings.recent || []).slice(0, 8);
    if (recent.length) {
      start.append(h("div", { class: "recent" }, h("h3", null, t("최근 파일")),
        recent.map((p) => h("div", { class: "recent-item", onclick: () => openArchive(p), title: p },
          svgEl(fileIcon(p, false)), h("span", { class: "nm" }, baseName(p)), h("span", { class: "p" }, dirName(p))))));
    }
  }

  function setMode(hasArchive) {
    pathbar.hidden = body.hidden = !hasArchive;
    start.hidden = hasArchive;
    const w = hasArchive && S.info?.writable;
    B.extract.disabled = B.test.disabled = B.info.disabled = !hasArchive;
    B.add.disabled = B.del.disabled = !w;
    B.view.disabled = !hasArchive || S.sel.size !== 1;
    if (!hasArchive) {
      renderStart();
      API.win.setTitle("DaperZip");
      status.innerHTML = "";
      status.append(h("span", null, "DaperZip"));
      API.call("app_info").then((i) => status.append(h("span", null, i.sevenzip.error ? t("7-Zip을 찾을 수 없습니다") : `7-Zip ${i.sevenzip.version}`)));
    }
  }

  // ---- archive model ----
  function buildIndex(info) {
    const children = new Map([["", []]]);
    const byPath = new Map();
    if (settings.skipMacJunk) {
      // hide macOS metadata (it is also skipped when extracting)
      info.entries = info.entries.filter((e) => !/(^|\/)(__MACOSX(\/|$)|\.DS_Store$)/.test(e.path));
    }
    for (const e of info.entries) {
      byPath.set(e.path, e);
      if (e.isDir && !children.has(e.path)) children.set(e.path, []);
      const parent = e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/")) : "";
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(e);
    }
    // folder sizes (sum of descendants)
    const dirSize = new Map();
    for (const e of info.entries) {
      if (e.isDir) continue;
      let p = e.path;
      while (p.includes("/")) {
        p = p.slice(0, p.lastIndexOf("/"));
        const v = dirSize.get(p) || [0, 0];
        v[0] += e.size; v[1] += e.packed;
        dirSize.set(p, v);
      }
    }
    for (const [p, [s, k]] of dirSize) { const e = byPath.get(p); if (e) { e.size = s; e.packed = k; } }
    S.children = children;
    S.byPath = byPath;
  }

  async function openArchive(path, { keepCwd = false } = {}) {
    try {
      const info = await API.withPassword(path, (pw) => API.call("list_archive", { path, password: pw }));
      settings = await API.call("get_settings");
      const prevCwd = S.cwd;
      S.archive = info.path;
      S.info = info;
      buildIndex(info);
      S.sel.clear();
      S.query = "";
      search.value = "";
      if (!keepCwd) { S.cwd = ""; S.back = []; S.fwd = []; S.expanded = new Set([""]); }
      else if (!S.children.has(prevCwd)) S.cwd = "";
      API.win.setTitle(`${baseName(info.path)} - DaperZip`);
      setMode(true);
      renderTree();
      refreshList();
      scroll.focus();
    } catch (e) {
      if (e.code !== "cancelled") await Dialogs.error(t("압축 파일을 열 수 없습니다"), e);
    }
  }

  const reload = () => S.archive && openArchive(S.archive, { keepCwd: true });

  // ---- navigation ----
  // push: "new" (normal navigation), "back" or "forward" (history moves)
  function navigate(dir, push = "new") {
    if (dir === S.cwd) return;
    if (push === "new") { S.back.push(S.cwd); S.fwd = []; }
    else if (push === "back") S.fwd.push(S.cwd);
    else if (push === "forward") S.back.push(S.cwd);
    S.cwd = dir;
    S.sel.clear();
    S.anchor = -1;
    S.query = "";
    search.value = "";
    // expand ancestors in tree
    let p = dir;
    while (p) { S.expanded.add(p); p = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""; }
    renderTree();
    refreshList();
    scroll.scrollTop = 0;
  }
  const goUp = () => S.cwd && navigate(S.cwd.includes("/") ? S.cwd.slice(0, S.cwd.lastIndexOf("/")) : "");
  const goBack = () => S.back.length && navigate(S.back.pop(), "back");
  const goForward = () => S.fwd.length && navigate(S.fwd.pop(), "forward");

  function renderCrumbs() {
    crumbs.innerHTML = "";
    crumbs.append(h("button", { class: "crumb", onclick: () => navigate("") }, svgEl(ICONS.archive || fileIcon(S.archive, false)), baseName(S.archive)));
    if (S.cwd) {
      let acc = "";
      for (const part of S.cwd.split("/")) {
        acc = acc ? acc + "/" + part : part;
        const target = acc;
        crumbs.append(h("span", { class: "crumb-sep" }, "›"), h("button", { class: "crumb", onclick: () => navigate(target) }, part));
      }
    }
    backBtn.disabled = !S.back.length;
    fwdBtn.disabled = !S.fwd.length;
    upBtn.disabled = !S.cwd;
  }

  // ---- tree ----
  function renderTree() {
    tree.innerHTML = "";
    const add = (path, name, depth) => {
      const kids = (S.children.get(path) || []).filter((e) => e.isDir).sort((a, b) => a.path.localeCompare(b.path));
      const open = S.expanded.has(path);
      const tw = h("span", { class: "tw" }, kids.length ? (open ? "▾" : "▸") : "");
      tw.addEventListener("click", (e) => { e.stopPropagation(); open ? S.expanded.delete(path) : S.expanded.add(path); renderTree(); });
      tree.append(h("div", { class: "tree-row" + (path === S.cwd ? " active" : ""), style: { paddingLeft: 6 + depth * 14 + "px" }, onclick: () => navigate(path), title: name },
        tw, svgEl(depth === 0 ? fileIcon(S.archive, false) : fileIcon("", true)), h("span", { class: "n" }, name)));
      if (open) for (const k of kids) add(k.path, k.path.split("/").pop(), depth + 1);
    };
    add("", baseName(S.archive), 0);
    tree.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }

  // ---- list ----
  function refreshList() {
    let items;
    if (S.query) items = S.info.entries.filter((e) => e.path.split("/").pop().toLowerCase().includes(S.query));
    else items = (S.children.get(S.cwd) || []).slice();
    const { key, dir } = S.sort;
    const name = (e) => e.path.split("/").pop();
    const val = (e) => key === "name" ? name(e).toLowerCase() : key === "type" ? fileTypeName(name(e), e.isDir) : e[key];
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      const x = val(a), y = val(b);
      const c = typeof x === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return c * dir;
    });
    S.items = items;
    inner.style.height = items.length * ROW + 8 + "px";
    empty.textContent = items.length ? "" : S.query ? t("검색 결과 없음") : t("빈 폴더");
    [...head.children].forEach((el, i) => {
      const c = COLS[i];
      el.textContent = t(c.label) + (S.sort.key === c.key ? (S.sort.dir > 0 ? " ▲" : " ▼") : "");
    });
    renderCrumbs();
    renderRows();
    renderStatus();
  }

  function renderRows() {
    const top = scroll.scrollTop, hgt = scroll.clientHeight || 600;
    const first = Math.max(0, Math.floor(top / ROW) - 5);
    const last = Math.min(S.items.length, Math.ceil((top + hgt) / ROW) + 5);
    inner.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = first; i < last; i++) {
      const e = S.items[i];
      const nm = e.path.split("/").pop();
      const row = h("div", { class: "row" + (S.sel.has(e.path) ? " sel" : ""), style: { top: 4 + i * ROW + "px", gridTemplateColumns: GRID }, "data-i": i },
        h("div", { class: "name", title: e.path },
          svgEl(fileIcon(nm, e.isDir)),
          e.encrypted ? svgEl(ICONS.lock.replace('class="i"', 'class="i lock"')) : null,
          h("span", null, nm),
          S.query && e.path.includes("/") ? h("span", { class: "muted" }, " — " + e.path.slice(0, e.path.lastIndexOf("/"))) : null),
        h("div", { class: "num" }, e.isDir && !e.size ? "" : fmtSize(e.size)),
        h("div", { class: "num muted" }, e.isDir && !e.packed ? "" : fmtSize(e.packed)),
        h("div", { class: "muted" }, e.modified ? e.modified.slice(0, 16) : ""),
        h("div", { class: "muted" }, fileTypeName(nm, e.isDir)));
      frag.append(row);
    }
    inner.append(frag);
  }
  scroll.addEventListener("scroll", () => requestAnimationFrame(renderRows));
  new ResizeObserver(() => S.archive && renderRows()).observe(scroll);

  function renderStatus() {
    status.innerHTML = "";
    if (!S.info) return;
    const files = S.info.entries.filter((e) => !e.isDir);
    const total = files.reduce((a, e) => a + e.size, 0);
    const selSize = [...S.sel].reduce((a, p) => a + (S.byPath.get(p)?.size || 0), 0);
    status.append(...[
      h("span", { class: "badge" }, S.info.kind.toUpperCase()),
      S.info.legacyCodepage ? h("span", { class: "badge", title: t("옛 Windows 방식으로 이름을 저장한 ZIP입니다. 한글이 깨지지 않도록 자동으로 변환했습니다.") }, "CP" + S.info.legacyCodepage) : null,
      h("span", null, t("항목 {n}개", { n: S.items.length.toLocaleString() })),
      S.sel.size ? h("span", null, `${t("{n}개 선택", { n: S.sel.size })} · ${fmtSize(selSize)}`) : null,
      h("span", { class: "spacer" }),
      S.info.entries.some((e) => e.encrypted) || S.info.encryptedHeaders ? h("span", null, "🔒 " + t("암호화")) : null,
      h("span", null, `${fmtSize(total)} → ${fmtSize(S.info.physicalSize)}`),
    ].filter(Boolean));
    B.view.disabled = S.sel.size !== 1;
    B.del.disabled = !S.info.writable || !S.sel.size;
  }

  // Update selection highlight without rebuilding rows (rebuilding between
  // mousedown and mouseup would swallow click/dblclick events).
  function paintSel() {
    for (const el of inner.children) el.classList.toggle("sel", S.sel.has(S.items[+el.dataset.i]?.path));
    renderStatus();
  }

  function selectedEntries() {
    return S.items.filter((e) => S.sel.has(e.path));
  }

  // ---- mouse ----
  // Pressing on a file's icon/name and dragging moves the files out (to
  // Explorer). Pressing anywhere else in the list and dragging draws a
  // selection rectangle.
  let dragStart = null;   // pending drag-out
  let band = null;        // pending/active selection rectangle
  const bandEl = h("div", { class: "band", hidden: true });
  scroll.append(bandEl);
  const contentY = (clientY) => clientY - scroll.getBoundingClientRect().top + scroll.scrollTop;
  const contentX = (clientX) => clientX - scroll.getBoundingClientRect().left + scroll.scrollLeft;

  scroll.addEventListener("mousedown", (e) => {
    if (e.button === 3 || e.button === 4) return; // side buttons: back/forward
    scroll.focus();
    const rowEl = e.target.closest(".row");
    const ctrl = e.ctrlKey || e.metaKey;
    if (!rowEl) {
      if (e.button !== 0) return;
      if (!ctrl && !e.shiftKey) { S.sel.clear(); paintSel(); }
      band = { x0: contentX(e.clientX), y0: contentY(e.clientY), base: new Set(S.sel), active: false };
      return;
    }
    const i = +rowEl.dataset.i, ent = S.items[i];
    if (e.button === 0 && e.detail === 2 && !e.shiftKey && !ctrl) {
      dragStart = band = null;
      S.sel = new Set([ent.path]);
      paintSel();
      openEntry(ent);
      return;
    }
    const onLabel = !!e.target.closest(".name svg, .name span");
    if (e.button === 2) {
      if (!S.sel.has(ent.path)) { S.sel = new Set([ent.path]); S.anchor = i; }
    } else if (e.shiftKey && S.anchor >= 0) {
      const [a, b] = [Math.min(S.anchor, i), Math.max(S.anchor, i)];
      S.sel = new Set(S.items.slice(a, b + 1).map((x) => x.path));
    } else if (ctrl) {
      S.sel.has(ent.path) ? S.sel.delete(ent.path) : S.sel.add(ent.path);
      S.anchor = i;
      if (e.button === 0 && !onLabel) band = { x0: contentX(e.clientX), y0: contentY(e.clientY), base: new Set(S.sel), active: false };
    } else {
      if (onLabel || S.sel.has(ent.path)) {
        if (!S.sel.has(ent.path)) S.sel = new Set([ent.path]);
        if (e.button === 0) dragStart = { x: e.clientX, y: e.clientY, i };
      } else {
        S.sel = new Set([ent.path]);
        if (e.button === 0) band = { x0: contentX(e.clientX), y0: contentY(e.clientY), base: new Set(), active: false };
      }
      S.anchor = i;
    }
    paintSel();
  });

  function updateBand(clientX, clientY) {
    const x1 = contentX(clientX), y1 = contentY(clientY);
    const top = Math.min(band.y0, y1), bottom = Math.max(band.y0, y1);
    const left = Math.max(0, Math.min(band.x0, x1)), right = Math.min(scroll.scrollWidth, Math.max(band.x0, x1));
    Object.assign(bandEl.style, { top: top + "px", left: left + "px", width: right - left + "px", height: bottom - top + "px" });
    bandEl.hidden = false;
    // rows start 4px from the top; select every row the rectangle touches
    const first = Math.max(0, Math.floor((top - 4) / ROW));
    const last = Math.min(S.items.length - 1, Math.floor((bottom - 4) / ROW));
    const next = new Set(band.base);
    for (let i = first; i <= last; i++) if (S.items[i]) next.add(S.items[i].path);
    S.sel = next;
    paintSel();
  }

  // keep scrolling while the pointer is above/below the list
  let bandScroll = null;
  function autoScroll(e) {
    clearInterval(bandScroll);
    const r = scroll.getBoundingClientRect();
    const dy = e.clientY < r.top + 8 ? -ROW : e.clientY > r.bottom - 8 ? ROW : 0;
    if (!dy) return;
    bandScroll = setInterval(() => {
      if (!band) return clearInterval(bandScroll);
      scroll.scrollTop += dy;
      updateBand(e.clientX, e.clientY);
    }, 40);
  }

  addEventListener("mousemove", (e) => {
    if (dragStart && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 8) {
      dragStart = null;
      dragOut();
    } else if (band) {
      if (!band.active && Math.hypot(contentX(e.clientX) - band.x0, contentY(e.clientY) - band.y0) < 5) return;
      band.active = true;
      updateBand(e.clientX, e.clientY);
      autoScroll(e);
    }
  });
  addEventListener("mouseup", (e) => {
    if (dragStart && !e.ctrlKey && !e.shiftKey) {
      // plain click on an already-selected row → select only it
      const ent = S.items[dragStart.i];
      if (ent && S.sel.size > 1) { S.sel = new Set([ent.path]); paintSel(); }
    }
    if (band && band.active) S.anchor = -1;
    dragStart = band = null;
    clearInterval(bandScroll);
    bandEl.hidden = true;
  });
  scroll.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const has = S.sel.size > 0, one = S.sel.size === 1, w = S.info?.writable;
    const ent = one ? S.byPath.get([...S.sel][0]) : null;
    showMenu(e.clientX, e.clientY, has ? [
      { icon: ICONS.view, label: t("열기"), key: "Enter", run: () => openEntry(ent), disabled: !one },
      { icon: ICONS.extract, label: t("선택한 항목 풀기..."), key: "Ctrl+E", run: () => extractDialog(true) },
      { icon: ICONS.extract, label: t("여기에 풀기"), run: () => extractSelectedTo(dirName(S.archive)) },
      { icon: ICONS.copy, label: t("복사"), key: "Ctrl+C", run: () => copySelected() },
      "-",
      { icon: ICONS.rename, label: t("이름 바꾸기"), key: "F2", run: () => renameSelected(), disabled: !w || !one },
      { icon: ICONS.delete, label: t("삭제"), key: "Del", run: () => deleteSelected(), disabled: !w },
    ] : [
      { icon: ICONS.add, label: t("파일 추가"), run: () => addFiles(), disabled: !w },
      { icon: ICONS.paste, label: t("붙여넣기"), key: "Ctrl+V", run: () => pasteFiles(), disabled: !w },
      { icon: ICONS.refresh, label: t("새로 고침"), key: "F5", run: () => reload() },
      { icon: ICONS.info, label: t("압축 파일 정보"), run: () => Dialogs.info(S.info) },
    ]);
  });

  // ---- back / forward ----
  // Mouse side buttons, Alt+←/→ and trackpad swipes are browser "history"
  // gestures, and the embedded browser (WebView2 on Windows) may handle
  // them before the page sees the input. So keep the page in the middle of
  // three history entries: a browser "back" lands on entry 0, "forward" on
  // entry 2; turn that into folder navigation and step back to the middle.
  let lastNav = 0;
  const navBack = () => { lastNav = performance.now(); goBack(); };
  const navForward = () => { lastNav = performance.now(); goForward(); };
  try {
    history.replaceState({ mz: 0 }, "");
    history.pushState({ mz: 1 }, "");
    history.pushState({ mz: 2 }, "");
    history.back();
  } catch (_) {}
  addEventListener("popstate", (e) => {
    const pos = e.state && e.state.mz;
    if (pos !== 0 && pos !== 2) return; // our own step back to the middle
    // skip if the mouse/keyboard handler below already navigated
    if (performance.now() - lastNav > 400 && S.archive && !Dialogs.open) pos === 0 ? goBack() : goForward();
    pos === 0 ? history.forward() : history.back();
  });
  // When the page does receive the input, handle it directly.
  const sideButton = (e) => e.button === 3 || e.button === 4;
  addEventListener("mousedown", (e) => { if (sideButton(e)) e.preventDefault(); });
  addEventListener("mouseup", (e) => {
    if (!sideButton(e)) return;
    e.preventDefault();
    if (!S.archive || Dialogs.open) return;
    e.button === 3 ? navBack() : navForward();
  });

  // ---- keyboard ----
  addEventListener("keydown", (e) => {
    if (Dialogs.open) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "o") { e.preventDefault(); pickAndOpen(); return; }
    if (ctrl && e.key.toLowerCase() === "n") { e.preventDefault(); pickAndCompress(); return; }
    if (ctrl && e.key.toLowerCase() === "v" && document.activeElement !== search) { e.preventDefault(); pasteFiles(); return; }
    if (!S.archive) return;
    if (ctrl && e.key.toLowerCase() === "f") { e.preventDefault(); search.focus(); return; }
    if (ctrl && e.key.toLowerCase() === "e") { e.preventDefault(); extractDialog(S.sel.size > 0); return; }
    if (e.key === "F5") { e.preventDefault(); reload(); return; }
    if (document.activeElement === search) {
      if (e.key === "Escape") { search.value = ""; S.query = ""; refreshList(); scroll.focus(); }
      if (e.key === "ArrowDown") scroll.focus();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "a") { e.preventDefault(); S.sel = new Set(S.items.map((x) => x.path)); paintSel(); return; }
    if (ctrl && e.key.toLowerCase() === "c") { e.preventDefault(); copySelected(); return; }
    if (e.key === "Backspace" || (e.altKey && e.key === "ArrowUp")) { e.preventDefault(); goUp(); return; }
    if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); navBack(); return; }
    if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); navForward(); return; }
    if (e.key === "BrowserBack") { e.preventDefault(); navBack(); return; }
    if (e.key === "BrowserForward") { e.preventDefault(); navForward(); return; }
    if (e.key === "Delete") { deleteSelected(); return; }
    if (e.key === "F2") { renameSelected(); return; }
    if (e.key === "Enter") { const s = selectedEntries(); if (s.length === 1) openEntry(s[0]); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      if (!S.items.length) return;
      let i = S.anchor;
      i = e.key === "Home" ? 0 : e.key === "End" ? S.items.length - 1 : Math.max(0, Math.min(S.items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
      S.sel = new Set([S.items[i].path]);
      S.anchor = i;
      const y = i * ROW;
      if (y < scroll.scrollTop) scroll.scrollTop = y;
      if (y + ROW * 2 > scroll.scrollTop + scroll.clientHeight) scroll.scrollTop = y + ROW * 2 - scroll.clientHeight;
      renderRows();
      renderStatus();
    }
  });

  // ===================================================================
  // Actions
  // ===================================================================
  const ARCHIVE_FILTER = [{ name: t("압축 파일"), extensions: ["zip", "7z", "rar", "tar", "gz", "tgz", "bz2", "xz", "txz", "zst", "iso", "cab", "wim", "001", "lzh", "arj", "jar", "apk", "zipx"] }, { name: t("모든 파일"), extensions: ["*"] }];

  async function pickAndOpen() {
    const p = await API.T.dialog.open({ multiple: false, filters: ARCHIVE_FILTER, title: t("압축 파일 열기") });
    if (!p) return;
    if (S.archive) API.call("open_window", { path: p });
    else openArchive(p);
  }

  async function pickAndCompress() {
    const files = await API.T.dialog.open({ multiple: true, title: t("압축할 파일 고르기") });
    if (files && files.length) compressFlow(files);
  }

  async function pickAndExtract() {
    const files = await API.T.dialog.open({ multiple: true, filters: ARCHIVE_FILTER, title: t("압축 풀기") });
    if (files && files.length) API.call("open_task_window", { action: "extract-dialog", paths: files });
  }

  async function compressFlow(paths) {
    const r = await Dialogs.compress({ sources: paths, settings });
    if (r && (await compressWith(paths, r))) {
      toast(t("압축 완료") + " — " + baseName(r.archive));
      if (!S.archive) openArchive(r.archive);
    }
  }

  function extractMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    if (!S.archive) return;
    API.call("archive_name", { path: S.archive }).then((stem) => {
      showMenu(r.left, r.bottom + 2, [
        { icon: ICONS.extract, label: t("다른 폴더에 풀기..."), key: "Ctrl+E", run: () => extractDialog(false) },
        { icon: ICONS.extract, label: t("여기에 풀기 (스마트)"), run: () => extractAuto("smart") },
        { icon: ICONS.extract, label: t("여기에 풀기"), run: () => extractAuto("here") },
        { icon: ICONS.extract, label: t("'{name}' 폴더에 풀기", { name: stem }), run: () => extractAuto("folder") },
        "-",
        { icon: ICONS.extract, label: t("선택한 항목 풀기..."), run: () => extractDialog(true), disabled: !S.sel.size },
      ]);
    });
  }

  function settingsMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    showMenu(r.right - 200, r.bottom + 2, [
      { icon: ICONS.settings, label: t("설정"), run: async () => {
        const next = await Dialogs.settings();
        if (next) { settings = next; if (S.archive) reload(); }
      } },
      { icon: ICONS.window, label: t("새 창"), run: () => API.call("open_window", { path: null }) },
      "-",
      { icon: ICONS.info, label: t("DaperZip 정보"), run: () => Dialogs.about() },
    ]);
  }

  async function extractAuto(mode) {
    const archive = S.archive;
    try {
      const r = await API.withPassword(archive, (pw) => API.runJob({ kind: "extractAuto", archive, mode, password: pw, overwrite: settings.extractOverwrite }, Dialogs.progress(t("압축 푸는 중"))));
      toast(t("풀기 완료") + " — " + r.dest);
      await afterExtract(r.dest, settings.extractOpenFolder);
    } catch (e) { await reportError(t("작업 실패"), e); }
  }

  async function extractDialog(selectedOnly) {
    if (!S.archive) return;
    const sel = selectedOnly ? selectedEntries() : [];
    const stem = await API.call("archive_name", { path: S.archive });
    const opts = await Dialogs.extract({
      archiveName: baseName(S.archive),
      defaultDest: joinPath(dirName(S.archive), stem),
      selected: sel.length ? sel.map((e) => e.path.split("/").pop()).slice(0, 3).join(", ") + (sel.length > 3 ? ` +${sel.length - 3}` : "") : "",
      settings,
    });
    if (!opts) return;
    await saveSettings({ extractOverwrite: opts.overwrite, extractOpenFolder: opts.openFolder });
    if (sel.length) return extractSelectedTo(opts.dest, opts);
    const archive = S.archive;
    try {
      await API.withPassword(archive, (pw) => API.runJob({ kind: "extract", archive, dest: opts.dest, password: pw, overwrite: opts.overwrite }, Dialogs.progress(t("압축 푸는 중"))));
      toast(t("풀기 완료") + " — " + opts.dest);
      await afterExtract(opts.dest, opts.openFolder);
    } catch (e) { await reportError(t("작업 실패"), e); }
  }

  async function extractSelectedTo(dest, opts = {}) {
    const items = selectedEntries().map((e) => e.raw);
    if (!items.length) return;
    const archive = S.archive, base = S.query ? "" : S.cwd;
    try {
      await API.withPassword(archive, (pw) => API.runJob({ kind: "extract", archive, dest, items, base, password: pw, overwrite: opts.overwrite || settings.extractOverwrite }, Dialogs.progress(t("압축 푸는 중"))));
      toast(t("풀기 완료") + " — " + dest);
      await afterExtract(dest, opts.openFolder ?? false);
    } catch (e) { await reportError(t("작업 실패"), e); }
  }

  async function openEntry(e) {
    if (!e) return;
    if (e.isDir) return navigate(e.path);
    const archive = S.archive;
    const nested = isArchiveName(e.path);
    try {
      const r = await API.withPassword(archive, (pw) => API.runJob({ kind: "open", archive, item: e.raw, password: pw, launch: !nested }, Dialogs.progress(t("파일 준비 중"))));
      if (nested) API.call("open_window", { path: r.path });
    } catch (err) { await reportError(t("작업 실패"), err); }
  }

  function openSelected() {
    const s = selectedEntries();
    if (s.length === 1) openEntry(s[0]);
  }

  async function addFiles(paths) {
    if (!S.info?.writable) return toast(t("이 형식은 수정할 수 없습니다."));
    if (!paths) {
      paths = await API.T.dialog.open({ multiple: true, title: t("파일 추가") });
      if (!paths || !paths.length) return;
    }
    if (!(await Dialogs.confirm(t("항목 {n}개를 '{name}'에 추가할까요?", { n: paths.length, name: baseName(S.archive) + (S.cwd ? "/" + S.cwd : "") }), t("추가")))) return;
    const archive = S.archive;
    const password = API.passwords.get(archive) ?? null;
    const isZip = /\.zip$/i.test(archive);
    try {
      await API.runJob({ kind: "add", archive, sources: paths, options: { archiveDir: S.cwd, level: 5, password, zipAes: isZip, encryptNames: !!S.info.encryptedHeaders } }, Dialogs.progress(t("압축하는 중")));
      await reload();
    } catch (e) { await reportError(t("작업 실패"), e); }
  }

  async function deleteSelected() {
    const items = selectedEntries().map((e) => e.raw);
    if (!items.length || !S.info?.writable) return;
    if (!(await Dialogs.confirm(t("선택한 항목 {n}개를 압축 파일에서 삭제할까요?", { n: items.length }), t("삭제"), true))) return;
    const archive = S.archive;
    try {
      await API.withPassword(archive, (pw) => API.runJob({ kind: "delete", archive, items, password: pw }, Dialogs.progress(t("삭제하는 중"))));
      await reload();
    } catch (e) { await reportError(t("작업 실패"), e); }
  }

  async function renameSelected() {
    const s = selectedEntries();
    if (s.length !== 1 || !S.info?.writable) return;
    const e = s[0];
    const old = e.path.split("/").pop();
    const name = await Dialogs.prompt(t("이름 바꾸기"), t("새 이름"), old);
    if (!name || name === old || /[\\/]/.test(name)) return;
    const parent = e.raw.includes("/") ? e.raw.slice(0, e.raw.lastIndexOf("/") + 1) : "";
    try {
      // 7-Zip renames a folder prefix together with everything inside it
      await API.withPassword(S.archive, (pw) => API.call("rename_entry", { archive: S.archive, old: e.raw, new: parent + name.normalize("NFC"), password: pw }));
      await reload();
    } catch (err) { await reportError(t("작업 실패"), err); }
  }

  async function testArchive() {
    const archive = S.archive;
    try {
      await API.withPassword(archive, (pw) => API.runJob({ kind: "test", archive, password: pw }, Dialogs.progress(t("검사하는 중"))));
      await Dialogs.message(t("테스트"), t("압축 파일에 오류가 없습니다."), { icon: ICONS.ok });
    } catch (e) { await reportError(t("작업 실패"), e); }
  }

  // ---- drag out to Explorer ----
  let draggingOut = false;
  let dragCache = null; // {key, paths}
  async function dragOut() {
    const items = selectedEntries().map((e) => e.raw);
    if (!items.length) return;
    const key = S.archive + "\n" + items.join("\n");
    try {
      let paths;
      if (dragCache?.key === key) paths = dragCache.paths;
      else {
        const t0 = performance.now();
        const archive = S.archive, base = S.query ? "" : S.cwd;
        const r = await API.withPassword(archive, (pw) => API.runJob({ kind: "prepareDrag", archive, items, base, password: pw }, Dialogs.progress(t("파일 준비 중"))));
        paths = r.paths;
        dragCache = { key, paths };
        // If preparing took long the mouse button is probably released already.
        if (performance.now() - t0 > 700) { toast(t("끌어서 꺼낼 준비가 되었습니다. 다시 끌어 놓으세요.")); return; }
      }
      draggingOut = true;
      await API.call("start_drag", { paths });
    } catch (e) {
      if (e.code !== "cancelled") toast(e.message);
    } finally {
      setTimeout(() => (draggingOut = false), 300);
    }
  }

  // ---- drop in from Explorer ----
  API.win.onDragDropEvent(async (ev) => {
    const p = ev.payload;
    if (draggingOut) return;
    if (p.type === "enter" || p.type === "over") {
      dropHint.hidden = false;
      dropHint.textContent = S.archive && S.info?.writable ? t("놓으면 압축 파일에 추가합니다") : t("놓으면 열거나 압축합니다");
    } else if (p.type === "leave") {
      dropHint.hidden = true;
    } else if (p.type === "drop") {
      dropHint.hidden = true;
      receivePaths(p.paths || []);
    }
  });

  /** Files dropped on the window or pasted with Ctrl+V. */
  async function receivePaths(paths) {
    {
      if (!paths.length || Dialogs.open) return;
      const infos = await API.call("path_info", { paths });
      const onlyArchives = infos.every((i) => i.isArchive);
      if (S.archive && S.info?.writable && !onlyArchives) return addFiles(paths);
      if (onlyArchives) {
        if (!S.archive) { openArchive(paths[0]); paths.slice(1).forEach((x) => API.call("open_window", { path: x })); }
        else if (S.info?.writable) {
          // archive on an open archive: ask what to do
          const add = await Dialogs.message("DaperZip", t("항목 {n}개를 '{name}'에 추가할까요?", { n: paths.length, name: baseName(S.archive) }), {
            icon: ICONS.question, buttons: [[t("새 창"), false], [t("추가"), true]] });
          add ? addFiles(paths) : paths.forEach((x) => API.call("open_window", { path: x }));
        } else paths.forEach((x) => API.call("open_window", { path: x }));
        return;
      }
      compressFlow(paths);
    }
  }

  // ---- clipboard: Ctrl+C copies selected items as files, Ctrl+V pastes ----
  async function copySelected() {
    const items = selectedEntries().map((e) => e.raw);
    if (!items.length) return;
    const archive = S.archive, base = S.query ? "" : S.cwd;
    try {
      const r = await API.withPassword(archive, (pw) => API.runJob({ kind: "copyToClipboard", archive, items, base, password: pw }, Dialogs.progress(t("파일 준비 중"))));
      toast(t("{n}개 항목을 복사했습니다. 탐색기에서 붙여넣기(Ctrl+V)하면 풀립니다.", { n: r.count }));
    } catch (e) { await reportError(t("작업 실패"), e); }
  }

  async function pasteFiles() {
    const paths = await API.call("clipboard_files").catch(() => []);
    if (paths.length) receivePaths(paths);
    else toast(t("붙여넣을 파일이 없습니다."));
  }

  // ---- files opened from the archive were edited ----
  API.win.listen("opened-file-changed", async (ev) => {
    const { archive, archiveDir, path, name } = ev.payload;
    if (archive !== S.archive) return;
    const ok = await Dialogs.message("DaperZip", t("'{name}' 파일이 바뀌었습니다. 압축 파일에도 반영할까요?", { name }), {
      icon: ICONS.question, buttons: [[t("아니요"), false], [t("반영"), true]] });
    if (!ok) return;
    if (!S.info?.writable) return toast(t("이 형식은 수정할 수 없습니다."));
    try {
      const password = API.passwords.get(archive) ?? null;
      await API.runJob({ kind: "add", archive, sources: [path], options: { archiveDir, level: 5, password, zipAes: /\.zip$/i.test(archive), encryptNames: !!S.info.encryptedHeaders } }, Dialogs.progress(t("압축하는 중")));
      await reload();
    } catch (e) { await reportError(t("작업 실패"), e); }
  });

  // ---- boot ----
  setMode(false);
  API.call("sync_shell_language", { ko: i18n.lang === "ko" }).catch(() => {});
  let restore = null;
  try { restore = JSON.parse(sessionStorage.getItem("daperzip.restore") || "null"); sessionStorage.removeItem("daperzip.restore"); } catch (_) {}
  if (restore && !(args.paths && args.paths[0])) {
    openArchive(restore.archive).then(() => { if (restore.cwd && S.children.has(restore.cwd)) navigate(restore.cwd); });
  }
  // Look for a new version a moment after start (once per run, quiet when offline).
  setTimeout(async () => {
    try {
      const u = await API.call("check_update", { manual: false });
      if (u && !Dialogs.open) Dialogs.updatePrompt(u);
    } catch (_) { /* offline */ }
  }, 2500);
  if (args.paths && args.paths[0]) {
    const p = args.paths[0];
    const [pi] = await API.call("path_info", { paths: [p] });
    if (pi && pi.exists && !pi.isDir) openArchive(p);
    else if (pi && pi.isDir) compressFlow([p]);
  }
})();
