// Bridge to the Rust side + small DOM helpers.
(function () {
  const T = window.__TAURI__;
  const invoke = (cmd, args) => T.core.invoke(cmd, args);
  const win = T.webviewWindow.getCurrentWebviewWindow();

  // --- DOM helpers ---
  window.h = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  window.svgEl = (markup) => {
    const t = document.createElement("template");
    t.innerHTML = markup.trim();
    return t.content.firstChild;
  };
  window.fmtSize = function (n) {
    if (n == null) return "";
    const u = ["B", "KB", "MB", "GB", "TB"];
    let i = 0, f = n;
    while (f >= 1024 && i < u.length - 1) { f /= 1024; i++; }
    return i === 0 ? `${f} B` : `${f.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${u[i]}`;
  };
  window.baseName = (p) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  window.dirName = (p) => { const s = p.replace(/[\\/]+$/, ""); const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\")); return i > 0 ? s.slice(0, i) : s; };
  window.joinPath = (d, n) => (d.endsWith("\\") || d.endsWith("/") ? d + n : d + (d.includes("\\") ? "\\" : "/") + n);

  let toastTimer;
  window.toast = function (msg, ms = 2600) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), ms);
  };

  // --- job events ---
  const handlers = new Map();
  const early = new Map(); // events that arrive before start_job returns
  function dispatch(kind, p) {
    const hd = handlers.get(p.id);
    if (!hd) {
      if (!early.has(p.id)) early.set(p.id, []);
      early.get(p.id).push([kind, p]);
      return;
    }
    if (kind === "done") { handlers.delete(p.id); hd.done(p); } else hd.progress(p);
  }
  win.listen("job-progress", (e) => dispatch("progress", e.payload));
  win.listen("job-done", (e) => dispatch("done", e.payload));

  class JobError extends Error {
    constructor(err) { super(err.message); this.code = err.code; this.details = err.details || ""; }
  }

  /**
   * Run a background job. `view` gets {start(cancel), update(pct, file), finish()}.
   * Resolves with the result, rejects with JobError.
   */
  function runJob(job, view) {
    return new Promise(async (resolve, reject) => {
      let id;
      const h = {
        progress: (p) => view?.update(p.percent, p.file),
        done: (p) => {
          view?.finish();
          p.ok ? resolve(p.result) : reject(new JobError(p.error));
        },
      };
      // register before invoking so no event is missed
      try {
        id = await invoke("start_job", { job });
      } catch (e) {
        view?.finish();
        return reject(new JobError({ code: "other", message: String(e) }));
      }
      handlers.set(id, h);
      view?.start(() => invoke("cancel_job", { id }));
      const queued = early.get(id) || [];
      early.delete(id);
      for (const [kind, p] of queued) dispatch(kind, p);
    });
  }

  async function call(cmd, args) {
    try {
      return await invoke(cmd, args);
    } catch (e) {
      throw new JobError(typeof e === "object" && e ? e : { code: "other", message: String(e) });
    }
  }

  // Remember passwords per archive for this window session.
  const passwords = new Map();

  /** Run fn(password) and ask for a password when the archive needs one. */
  async function withPassword(archive, fn) {
    let pw = passwords.get(archive) ?? null;
    let wrong = false;
    for (;;) {
      try {
        const r = await fn(pw);
        if (pw != null) passwords.set(archive, pw);
        return r;
      } catch (e) {
        if (e.code === "password_required" || e.code === "wrong_password") {
          wrong = e.code === "wrong_password" || pw != null;
          pw = await Dialogs.password(baseName(archive), wrong);
          if (pw == null) throw new JobError({ code: "cancelled", message: t("취소했습니다.") });
          continue;
        }
        throw e;
      }
    }
  }

  window.API = { invoke, call, win, runJob, withPassword, passwords, JobError, T };
})();
