// Modal dialogs. Each returns a Promise.
(function () {
  const overlay = document.getElementById("overlay");
  const stack = [];

  function open(dlg, { onEnter, onEscape } = {}) {
    stack.forEach((d) => (d.hidden = true));
    stack.push(dlg);
    overlay.append(dlg);
    overlay.hidden = false;
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && onEscape) { e.preventDefault(); onEscape(); }
      if (e.key === "Enter" && onEnter && e.target.tagName !== "BUTTON" && e.target.tagName !== "SELECT") { e.preventDefault(); onEnter(); }
    });
    setTimeout(() => (dlg.querySelector("[autofocus]") || dlg.querySelector("input,select,.btn.primary"))?.focus(), 0);
    return () => {
      dlg.remove();
      stack.splice(stack.indexOf(dlg), 1);
      if (stack.length) stack[stack.length - 1].hidden = false;
      else overlay.hidden = true;
    };
  }

  function frame(icon, title, body, buttons, cls = "") {
    return h("div", { class: "dlg " + cls, role: "dialog" },
      h("div", { class: "dlg-head" }, icon ? svgEl(icon) : null, h("span", null, title)),
      h("div", { class: "dlg-body" }, body),
      h("div", { class: "dlg-foot" }, buttons));
  }

  const Dialogs = {
    get open() { return stack.length > 0; },

    message(title, text, { icon = ICONS.info, details = "", buttons = [[t("확인"), true]], escape } = {}) {
      return new Promise((resolve) => {
        let close;
        const det = details ? h("details", null, h("summary", null, t("자세히")), h("div", { class: "details" }, details)) : null;
        const btns = buttons.map(([label, val, cls], i) =>
          h("button", { class: "btn " + (cls || (i === buttons.length - 1 ? "primary" : "")), onclick: () => { close(); resolve(val); } }, label));
        const dlg = frame(icon, title, [h("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, text), det], btns);
        close = open(dlg, { onEscape: () => { close(); resolve(escape !== undefined ? escape : buttons.length > 1 ? buttons[0][1] : true); } });
      });
    },

    error(title, err) {
      return Dialogs.message(title, err.message || String(err), { icon: ICONS.error, details: err.details || "" });
    },

    confirm(text, okLabel = t("확인"), danger = false) {
      return Dialogs.message("DaperZip", text, { icon: ICONS.question, buttons: [[t("취소"), false], [okLabel, true, danger ? "primary" : "primary"]] });
    },

    prompt(title, label, value) {
      return new Promise((resolve) => {
        const inp = h("input", { type: "text", value, autofocus: true });
        let close;
        const ok = () => { const v = inp.value.trim(); if (v) { close(); resolve(v); } };
        const cancel = () => { close(); resolve(null); };
        const dlg = frame(ICONS.rename, title, [h("div", { class: "field" }, h("label", null, label), inp)],
          [h("button", { class: "btn", onclick: cancel }, t("취소")), h("button", { class: "btn primary", onclick: ok }, t("확인"))]);
        close = open(dlg, { onEnter: ok, onEscape: cancel });
        setTimeout(() => { const dot = value.lastIndexOf("."); inp.setSelectionRange(0, dot > 0 ? dot : value.length); }, 10);
      });
    },

    password(name, wrong) {
      return new Promise((resolve) => {
        const inp = h("input", { type: "password", autofocus: true, placeholder: t("비밀번호") });
        const show = h("input", { type: "checkbox", onchange: () => (inp.type = show.checked ? "text" : "password") });
        let close;
        const ok = () => { close(); resolve(inp.value); };
        const cancel = () => { close(); resolve(null); };
        const dlg = frame(ICONS.lock, t("비밀번호 입력"), [
          h("div", null, t("'{name}'은(는) 암호화되어 있습니다.", { name })),
          wrong ? h("div", { class: "err" }, t("비밀번호가 틀렸습니다. 다시 입력하세요.")) : null,
          inp,
          h("label", { class: "check" }, show, t("비밀번호 표시")),
        ], [h("button", { class: "btn", onclick: cancel }, t("취소")), h("button", { class: "btn primary", onclick: ok }, t("확인"))]);
        close = open(dlg, { onEnter: ok, onEscape: cancel });
      });
    },

    /** Modal progress view for runJob. */
    progress(title) {
      let close, cancelFn, timer;
      const bar = h("div");
      const pct = h("b", null, "0%");
      const file = h("div", { class: "prog-file" }, t("준비 중..."));
      const wrap = h("div", { class: "progress indet" }, bar);
      const cancelBtn = h("button", { class: "btn", onclick: () => { cancelBtn.disabled = true; cancelFn?.(); } }, t("취소"));
      const dlg = frame(null, title, [h("div", { class: "prog-top" }, h("span", { class: "muted" }, title), pct), wrap, file], [cancelBtn]);
      return {
        start(cancel) {
          cancelFn = cancel;
          cancelBtn.hidden = !cancel;
          // avoid flashing a dialog for very quick jobs
          timer = setTimeout(() => { close = open(dlg, { onEscape: () => cancelBtn.click() }); }, 180);
        },
        update(p, f) {
          wrap.classList.remove("indet");
          bar.style.width = p + "%";
          pct.textContent = p + "%";
          if (f) file.textContent = f;
        },
        finish() { clearTimeout(timer); close?.(); },
      };
    },

    /** Extract options. Returns {dest, overwrite, openFolder} or null. */
    extract({ archiveName, defaultDest, selected, settings }) {
      return new Promise((resolve) => {
        const hist = [...new Set([defaultDest, ...(settings.extractHistory || [])])].slice(0, 10);
        const dest = h("input", { type: "text", value: defaultDest, list: "dest-hist", autofocus: true });
        const dl = h("datalist", { id: "dest-hist" }, hist.map((p) => h("option", { value: p })));
        const browse = h("button", { class: "btn", onclick: async () => {
          const d = await API.T.dialog.open({ directory: true, defaultPath: dest.value || undefined, title: t("폴더 고르기") });
          if (d) dest.value = d;
        } }, t("찾아보기"));
        const ow = h("select", null,
          h("option", { value: "rename" }, t("이름 바꿔서 저장")),
          h("option", { value: "overwrite" }, t("덮어쓰기")),
          h("option", { value: "skip" }, t("건너뛰기")));
        ow.value = settings.extractOverwrite || "rename";
        const openF = h("input", { type: "checkbox" });
        openF.checked = settings.extractOpenFolder;
        let close;
        const ok = () => {
          if (!dest.value.trim()) return;
          close();
          resolve({ dest: dest.value.trim(), overwrite: ow.value, openFolder: openF.checked });
        };
        const cancel = () => { close(); resolve(null); };
        const dlg = frame(ICONS.extract, t("압축 풀기") + " — " + archiveName, [
          selected ? h("div", { class: "note" }, t("선택한 항목") + `: ${selected}`) : null,
          h("div", { class: "field" }, h("label", null, t("풀 위치")), h("div", { class: "hrow" }, dest, browse), dl),
          h("div", { class: "field" }, h("label", null, t("같은 이름의 파일이 있으면")), ow),
          h("label", { class: "check" }, openF, t("끝나면 폴더 열기")),
        ], [h("button", { class: "btn", onclick: cancel }, t("취소")), h("button", { class: "btn primary", onclick: ok }, t("압축 풀기"))], "wide");
        close = open(dlg, { onEnter: ok, onEscape: cancel });
      });
    },

    /**
     * Compress form. `standalone` renders into a container instead of a modal.
     * Resolves {archive, options, openFolder} or null.
     */
    compress({ sources, settings, container }) {
      return new Promise(async (resolve) => {
        const infos = await API.call("path_info", { paths: sources });
        const fmt = h("select", null,
          ["zip", "7z", "tgz", "txz", "tbz", "tar", "wim"].map((f) =>
            h("option", { value: f }, { zip: "ZIP", "7z": "7Z", tar: "TAR", tgz: "TAR.GZ", tbz: "TAR.BZ2", txz: "TAR.XZ", wim: "WIM" }[f])));
        fmt.value = settings.compressFormat || "zip";
        const level = h("select", null,
          [[0, t("저장 (압축 안 함)")], [1, t("빠름")], [5, t("보통")], [7, t("높음")], [9, t("최고")]].map(([v, l]) => h("option", { value: v }, l)));
        level.value = String(settings.compressLevel ?? 5);
        const split = h("select", null,
          [["", t("분할 안 함")], ["10m", "10 MB"], ["100m", "100 MB"], ["700m", "700 MB (CD)"], ["1g", "1 GB"], ["4092m", "4 GB (FAT32)"]].map(([v, l]) => h("option", { value: v }, l)));
        const out = h("input", { type: "text" });
        const ext = { zip: ".zip", "7z": ".7z", tar: ".tar", tgz: ".tar.gz", tbz: ".tar.bz2", txz: ".tar.xz", wim: ".wim" };
        const stripExt = (p) => p.replace(/\.(tar\.(gz|bz2|xz)|zip|7z|tar|wim)$/i, "");
        const suggest = async () => { out.value = await API.call("suggest_archive_path", { sources, format: fmt.value }); };
        await suggest();
        let userEdited = false;
        out.addEventListener("input", () => (userEdited = true));
        const pw = h("input", { type: "password", placeholder: t("비밀번호"), autocomplete: "new-password" });
        const pw2 = h("input", { type: "password", placeholder: t("비밀번호 확인"), autocomplete: "new-password" });
        const show = h("input", { type: "checkbox", onchange: () => (pw.type = pw2.type = show.checked ? "text" : "password") });
        const encNames = h("input", { type: "checkbox" });
        const aes = h("input", { type: "checkbox", checked: true });
        const openF = h("input", { type: "checkbox" });
        openF.checked = !!settings.compressOpenFolder;
        const encNamesRow = h("label", { class: "check" }, encNames, t("파일 이름도 암호화"));
        const aesRow = h("label", { class: "check" }, aes, t("AES-256 암호화 (권장)"));
        const pwBlock = h("div", { class: "field" }, h("label", null, t("암호화")), h("div", { class: "grid2" }, pw, pw2),
          h("label", { class: "check" }, show, t("비밀번호 표시")), encNamesRow, aesRow);
        const err = h("div", { class: "err" });
        const sync = () => {
          const f = fmt.value;
          const canPw = f === "zip" || f === "7z";
          pwBlock.hidden = !canPw;
          encNamesRow.hidden = f !== "7z";
          aesRow.hidden = f !== "zip";
          if (!userEdited) suggest();
          else out.value = stripExt(out.value) + ext[f];
        };
        fmt.addEventListener("change", sync);
        sync();
        const browse = h("button", { class: "btn", onclick: async () => {
          const p = await API.T.dialog.save({ defaultPath: out.value, title: t("압축 파일 위치와 이름") });
          if (p) { out.value = p; userEdited = true; }
        } }, t("찾아보기"));

        const srcList = h("div", { class: "src-list" }, infos.map((i) => h("div", null, svgEl(fileIcon(i.name, i.isDir)), i.path)));
        let close = () => {};
        const ok = async () => {
          err.textContent = "";
          if (!pwBlock.hidden && pw.value !== pw2.value) { err.textContent = t("비밀번호가 일치하지 않습니다."); return; }
          const archive = out.value.trim();
          if (!archive) return;
          if (await API.call("file_exists", { path: archive })) {
            if (!(await Dialogs.confirm(t("압축 파일이 이미 있습니다. 파일을 추가할까요?"), t("추가")))) return;
          }
          close();
          resolve({
            archive,
            openFolder: openF.checked,
            options: {
              format: fmt.value,
              level: Number(level.value),
              password: !pwBlock.hidden && pw.value ? pw.value : null,
              encryptNames: encNames.checked,
              zipAes: aes.checked,
              volumeSize: split.value,
            },
          });
        };
        const cancel = () => { close(); resolve(null); };
        const body = [
          h("div", { class: "field" }, h("label", null, t("압축할 항목 {n}개", { n: sources.length })), srcList),
          h("div", { class: "field" }, h("label", null, t("압축 파일 위치와 이름")), h("div", { class: "hrow" }, out, browse)),
          h("div", { class: "grid2" },
            h("div", { class: "field" }, h("label", null, t("압축 형식")), fmt),
            h("div", { class: "field" }, h("label", null, t("압축 레벨")), level)),
          h("div", { class: "field" }, h("label", null, t("분할 압축")), split),
          pwBlock,
          h("label", { class: "check" }, openF, t("끝나면 폴더 열기")),
          err,
        ];
        const buttons = [h("button", { class: "btn", onclick: cancel }, t("취소")), h("button", { class: "btn primary", onclick: ok }, t("압축"))];
        const dlg = frame(ICONS.compress, t("새로 압축하기"), body, buttons, "wide");
        if (container) {
          dlg.classList.add("task", "form");
          dlg.style.cssText = "width:100%;max-height:none;height:100%;border:0;border-radius:0;box-shadow:none";
          container.append(dlg);
          dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") cancel(); });
          close = () => dlg.remove();
        } else {
          close = open(dlg, { onEscape: cancel });
        }
      });
    },

    info(info) {
      const files = info.entries.filter((e) => !e.isDir);
      const size = files.reduce((a, e) => a + e.size, 0);
      const packed = info.physicalSize || files.reduce((a, e) => a + e.packed, 0);
      const ratio = size ? Math.round((packed / size) * 100) + "%" : "-";
      const yes = (b) => (b ? t("예") : t("아니요"));
      const rows = [
        [t("경로"), info.path], [t("형식"), info.kind], [t("방식"), info.method || "-"],
        [t("파일 수"), files.length.toLocaleString()], [t("폴더 수"), (info.entries.length - files.length).toLocaleString()],
        [t("원본 크기"), `${fmtSize(size)} (${size.toLocaleString()} B)`], [t("압축 크기"), `${fmtSize(packed)} (${packed.toLocaleString()} B)`],
        [t("압축률"), ratio], [t("솔리드"), yes(info.solid)],
        [t("암호화"), yes(info.encryptedHeaders || info.entries.some((e) => e.encrypted))],
        [t("분할 압축 파일"), yes(info.multiVolume)], [t("수정 가능"), yes(info.writable)],
      ];
      if (info.comment) rows.push([t("주석"), info.comment]);
      return Dialogs.message(t("압축 파일 정보"), h("div", { class: "kv" }, rows.flatMap(([k, v]) => [h("div", null, k), h("div", null, v)])), { icon: ICONS.info });
    },

    async settings() {
      const s = await API.call("get_settings");
      const info = await API.call("app_info");
      const isWin = info.platform === "windows";
      const lang = h("select", null, h("option", { value: "system" }, t("시스템 언어")), h("option", { value: "ko" }, "한국어"), h("option", { value: "en" }, "English"));
      lang.value = s.language;
      const theme = h("select", null, h("option", { value: "system" }, t("시스템 설정")), h("option", { value: "light" }, t("밝게")), h("option", { value: "dark" }, t("어둡게")));
      theme.value = s.theme;
      const cp = h("select", null, h("option", { value: "" }, t("자동 (권장)")), h("option", { value: "949" }, t("한국어 CP949 (한글이 깨질 때)")), h("option", { value: "65001" }, "UTF-8"), h("option", { value: "932" }, "日本語 CP932"), h("option", { value: "936" }, "中文 CP936"));
      cp.value = s.codepage;
      const szp = h("input", { type: "text", value: s.sevenzipPath, placeholder: info.sevenzip.path || t("7-Zip을 찾을 수 없습니다") });
      const watch = h("input", { type: "checkbox" });
      watch.checked = s.watchOpenedFiles;
      const upd = h("input", { type: "checkbox" });
      upd.checked = s.checkUpdates;
      const nfcBox = h("input", { type: "checkbox" });
      nfcBox.checked = s.normalizeNames;
      const junk = h("input", { type: "checkbox" });
      junk.checked = s.skipMacJunk;
      // Installed "for all users": the installer manages the menu (HKLM).
      const machineMenu = info.shellMenuScope === "machine";
      const menu = h("input", { type: "checkbox", disabled: !isWin || machineMenu });
      menu.checked = info.shellMenu;
      const assoc = h("input", { type: "checkbox", disabled: !isWin });
      assoc.checked = info.assoc;
      const err = h("div", { class: "err" });
      const engine = info.sevenzip.error
        ? h("div", { class: "err" }, info.sevenzip.error)
        : h("div", { class: "note" }, `7-Zip ${info.sevenzip.version} — ${info.sevenzip.path}`);
      const body = [
        h("div", { class: "section-title" }, t("일반")),
        h("div", { class: "grid2" },
          h("div", { class: "field" }, h("label", null, t("언어")), lang),
          h("div", { class: "field" }, h("label", null, t("테마")), theme)),
        h("label", { class: "check" }, watch, t("열어 본 파일이 바뀌면 압축 파일에 반영할지 묻기")),
        h("div", { class: "hrow" }, h("label", { class: "check", style: { flex: 1 } }, upd, t("시작할 때 새 버전 확인")),
          h("button", { class: "btn", onclick: async (ev) => {
            ev.currentTarget.disabled = true;
            try {
              const u = await API.call("check_update", { manual: true });
              if (u) await Dialogs.updatePrompt(u);
              else toast(t("최신 버전입니다."));
            } catch (e) { toast(t("업데이트를 확인할 수 없습니다.")); }
            finally { ev.target.disabled = false; }
          } }, t("지금 확인"))),
        h("div", { class: "section-title" }, t("엔진")),
        h("div", { class: "field" }, h("label", null, t("7-Zip 경로 (비우면 자동)")), szp), engine,
        h("div", { class: "field" }, h("label", null, t("ZIP 파일 이름 인코딩")), cp),
        h("div", { class: "section-title" }, t("파일 이름 (Mac 호환)")),
        h("label", { class: "check" }, nfcBox, t("Mac에서 자모가 분리된 한글 이름을 정상으로 고치기 (NFC)")),
        h("label", { class: "check" }, junk, t("Mac 전용 파일(.DS_Store, __MACOSX, ._*) 제외")),
        h("div", { class: "section-title" }, t("Windows 탐색기 통합")),
        h("label", { class: "check" }, menu, t("오른쪽 클릭 메뉴에 DaperZip 추가")),
        machineMenu ? h("div", { class: "note" }, t("모든 사용자용으로 설치되어 설치 프로그램이 관리합니다.")) : null,
        h("label", { class: "check" }, assoc, t("압축 파일 '연결 프로그램'에 DaperZip 등록")),
        h("div", { class: "note" }, isWin ? t("Windows 11에서는 '추가 옵션 표시' 안에 나타납니다.") : t("Windows에서만 사용할 수 있습니다.") + " " + t("Mac/Linux에서는 Finder·파일 관리자의 '다음으로 열기'로 DaperZip을 고를 수 있습니다.")),
        isWin ? h("div", null, h("button", { class: "btn", onclick: () => API.call("open_default_apps") }, t("기본 앱 설정 열기"))) : null,
        err,
      ];
      return new Promise((resolve) => {
        let close;
        const save = async () => {
          try {
            if (menu.checked !== info.shellMenu) await API.call("set_shell_menu", { enabled: menu.checked });
            if (assoc.checked !== info.assoc) await API.call("set_file_assoc", { enabled: assoc.checked });
          } catch (e) { err.textContent = e.message; return; }
          const next = { ...s, language: lang.value, theme: theme.value, codepage: cp.value, sevenzipPath: szp.value.trim(), watchOpenedFiles: watch.checked, normalizeNames: nfcBox.checked, checkUpdates: upd.checked, skipMacJunk: junk.checked };
          await API.call("set_settings", { settings: next });
          close();
          resolve(next);
        };
        const cancel = () => { close(); resolve(null); };
        const dlg = frame(ICONS.settings, t("설정"), body, [h("button", { class: "btn", onclick: cancel }, t("취소")), h("button", { class: "btn primary", onclick: save }, t("확인"))], "wide");
        close = open(dlg, { onEscape: cancel });
      });
    },

    /** Ask whether to install a new version. */
    async updatePrompt(info) {
      const notes = (info.notes || "").trim();
      const choice = await Dialogs.message(t("업데이트"), h("div", null,
        h("div", null, t("새 버전 {v}이(가) 있습니다. 지금 업데이트할까요?", { v: info.latest })),
        h("div", { class: "note", style: { marginTop: "6px" } }, `${t("현재 버전")} ${info.current}`),
        notes ? h("div", { class: "details", style: { marginTop: "8px" } }, notes.slice(0, 2000)) : null), {
        icon: ICONS.info,
        buttons: [[t("이 버전 건너뛰기"), "skip"], [t("나중에"), "later"], [t("업데이트"), "update"]],
        escape: "later",
      });
      if (choice === "skip") return API.call("skip_update", { version: info.latest });
      if (choice !== "update") return;
      const view = Dialogs.progress(t("업데이트 받는 중"));
      view.start(null);
      try {
        await API.call("install_update", { assetUrl: info.assetUrl, assetName: info.assetName, page: info.url });
      } catch (e) {
        await Dialogs.error(t("업데이트"), e);
      } finally {
        view.finish();
      }
    },

    async about() {
      const info = await API.call("app_info");
      return Dialogs.message(t("DaperZip 정보"), h("div", null,
        h("div", { class: "brand", style: { marginBottom: "10px" } }, h("span", { class: "logo", role: "img", "aria-label": "Daper" }), h("div", null, h("h1", { style: { fontSize: "20px" } }, "DaperZip"), h("p", null, `${t("버전")} ${info.version}`))),
        h("p", null, t("압축 엔진: 7-Zip (LGPL)") + " · " + t("라이선스: MIT")),
        h("p", null, h("a", { href: "#", onclick: (e) => { e.preventDefault(); API.call("open_url", { url: "https://dapercorp.com" }); } }, "dapercorp.com")),
        h("p", { class: "note" }, info.sevenzip.error || `7-Zip ${info.sevenzip.version}`)), { icon: null });
    },
  };
  window.Dialogs = Dialogs;
})();
