import { app } from "../../scripts/app.js";

const NODE_ID = "XAI_PromptEditor";
const EXTENSION_NAME = "xAI.PromptEditor";
const CSS_ID = "xai-prompt-editor-css-v4";
const UI_REV = 4;

const VIEW = {
  CURRENT: "CURRENT",
  LAST_MANUAL: "LAST_MANUAL",
  LAST_LLM: "LAST_LLM",
};

function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const link = document.createElement("link");
  link.id = CSS_ID;
  link.rel = "stylesheet";
  try {
    link.href = new URL("./prompt_editor.css", import.meta.url).href + "?v=4";
  } catch {
    link.href = new URL("prompt_editor.css", import.meta.url).href + "?v=4";
  }
  document.head.appendChild(link);
}

function isWordChar(ch) {
  return /[0-9A-Za-z_]/.test(ch);
}

function findMatches(text, query, caseSensitive, wholeWord) {
  if (!query || text == null) return [];
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches = [];
  let start = 0;
  const nlen = needle.length;
  while (start <= hay.length) {
    const idx = hay.indexOf(needle, start);
    if (idx < 0) break;
    const end = idx + nlen;
    if (wholeWord) {
      const leftOk = idx === 0 || !isWordChar(text[idx - 1]);
      const rightOk = end >= text.length || !isWordChar(text[end]);
      if (!leftOk || !rightOk) {
        start = idx + 1;
        continue;
      }
    }
    matches.push([idx, end]);
    start = idx + Math.max(nlen, 1);
  }
  return matches;
}

function countWords(text) {
  if (!text) return 0;
  const parts = text.trim().split(/\s+/);
  return parts[0] ? parts.length : 0;
}

function extractExecutedText(output) {
  if (!output) return null;
  const t = output.text;
  if (typeof t === "string") return t;
  if (Array.isArray(t) && t.length) {
    const first = t[0];
    if (typeof first === "string") return first;
    if (first != null) return String(first);
  }
  return null;
}

function hideWidget(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
  if (widget.element) widget.element.style.display = "none";
}

function getWidget(node, name) {
  return node.widgets?.find((w) => w.name === name);
}

function setWidgetValue(node, name, value) {
  const w = getWidget(node, name);
  if (!w) return;
  w.value = value;
}

function getWidgetValue(node, name) {
  const w = getWidget(node, name);
  return w && typeof w.value === "string" ? w.value : "";
}

function isTextConnected(node) {
  const input = node.inputs?.find((i) => i.name === "text");
  return !!(input && (input.link != null || input.link === 0));
}

function isClipboardFilePathJunk(text) {
  const t = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (!t) return true;
  if (/ScreenClip/i.test(t)) return true;
  if (/[\\/]TempState[\\/]/i.test(t)) return true;
  if (/MicrosoftWindows\.Client/i.test(t)) return true;
  if (/\{[0-9A-Fa-f-]{36}\}/.test(t) && /\.png/i.test(t)) return true;
  if (/^[a-zA-Z]:[\\/].+\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(t)) return true;
  if (/^file:\/\/.+\.(png|jpe?g|gif|webp|bmp)/i.test(t)) return true;
  if (/^\/.+\.(png|jpe?g|gif|webp|bmp)$/i.test(t) && t.indexOf(" ") < 0) return true;
  return false;
}

function htmlToPlain(html) {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body?.textContent || "").trim();
  } catch {
    return "";
  }
}

function pickClipboardText(plain, html) {
  if (plain && !isClipboardFilePathJunk(plain)) return plain;
  const fromHtml = htmlToPlain(html);
  if (fromHtml && !isClipboardFilePathJunk(fromHtml)) return fromHtml;
  return null;
}

function readOsClipboardViaCapture() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      document.removeEventListener("paste", onPaste, true);
      resolve(value);
    };
    const onPaste = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const plain = e.clipboardData?.getData("text/plain") || "";
      const html = e.clipboardData?.getData("text/html") || "";
      finish(pickClipboardText(plain, html));
    };
    document.addEventListener("paste", onPaste, true);
    let ok = false;
    try {
      ok = document.execCommand("paste");
    } catch {
      ok = false;
    }
    if (!ok) finish(null);
    else window.setTimeout(() => finish(null), 80);
  });
}

async function readClipboardPlainText() {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        let plain = "";
        let html = "";
        if (item.types?.includes("text/plain")) {
          plain = await (await item.getType("text/plain")).text();
        }
        if (item.types?.includes("text/html")) {
          html = await (await item.getType("text/html")).text();
        }
        const picked = pickClipboardText(plain, html);
        if (picked) return picked;
      }
    }
  } catch {
    /* try readText */
  }
  try {
    if (navigator.clipboard?.readText) {
      const picked = pickClipboardText(await navigator.clipboard.readText(), "");
      if (picked) return picked;
    }
  } catch {
    /* none */
  }
  return null;
}

async function copyExact(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (val == null || val === false) continue;
      if (key === "class") node.className = val;
      else if (key === "text") node.textContent = val;
      else if (key.startsWith("on") && typeof val === "function") node.addEventListener(key.slice(2), val);
      else if (key === "dataset") {
        for (const [dk, dv] of Object.entries(val)) node.dataset[dk] = dv;
      } else if (typeof val === "boolean") {
        if (val) node.setAttribute(key, "");
      } else {
        node.setAttribute(key, String(val));
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (child) node.appendChild(child);
    }
  }
  return node;
}

class PromptEditorController {
  constructor(node) {
    this.node = node;
    this.viewMode = VIEW.CURRENT;
    this.historyUnlocked = false;
    this.searchOpen = false;
    this.replaceOpen = false;
    this.matchIndex = -1;
    this.matches = [];
    this.copyTimer = 0;
    this.pasteTimer = 0;
    this.disposed = false;
    this._syncingEditor = false;
    this._listeners = [];
    this._connected = false;
    this._hasLlmValue = false;
    this._hasManualValue = false;
    this._pulseTimer = 0;

    this.root = this._buildDom();
    this._bindNode();
    this._syncFromWidgets();
    this.refreshConnectionStatus();
    this.render();
  }

  _buildDom() {
    this.statusLight = el("span", { class: "xai-pe-light", "aria-hidden": "true" });
    this.statusLabel = el("span", { class: "xai-pe-status-label", text: "MANUAL" });
    this.statusEl = el("button", {
      class: "xai-pe-status",
      type: "button",
      "aria-live": "polite",
      title: "Connect a STRING to use LLM mode.",
    }, [this.statusLight, this.statusLabel]);
    this.btnFind = el("button", { class: "xai-pe-btn", type: "button", text: "Find", title: "Find (Ctrl+F)" });
    this.btnReplace = el("button", {
      class: "xai-pe-btn",
      type: "button",
      text: "Find & Replace",
      title: "Find & Replace (Ctrl+H)",
    });
    this.btnCopy = el("button", {
      class: "xai-pe-btn",
      type: "button",
      text: "Copy",
      title: "Copy the text currently displayed in the editor",
    });
    this.btnPaste = el("button", {
      class: "xai-pe-btn",
      type: "button",
      text: "Paste",
      title: "Replace the displayed text with the clipboard (Ctrl+Shift+V)",
    });
    this.btnLastManual = el("button", {
      class: "xai-pe-btn",
      type: "button",
      text: "Last Manual Input",
      title: "View stored last manual prompt. Does not change connections, status, or active output.",
    });
    this.btnLastLlm = el("button", {
      class: "xai-pe-btn",
      type: "button",
      text: "Last LLM Input",
      title: "View stored last connected STRING. Does not change connections, status, or active output.",
    });
    this.btnUseCurrent = el("button", {
      class: "xai-pe-btn xai-pe-use-current",
      type: "button",
      text: "Use as current",
      title: "Make this history text the live MANUAL prompt. Graph output will follow it.",
      hidden: true,
    });

    const toolbar = el("div", { class: "xai-pe-toolbar" }, [
      this.statusEl,
      this.btnFind,
      this.btnReplace,
      this.btnCopy,
      this.btnPaste,
      this.btnLastManual,
      this.btnLastLlm,
      this.btnUseCurrent,
    ]);

    this.findInput = el("input", {
      type: "text",
      placeholder: "Find",
      spellcheck: "false",
      autocomplete: "off",
      "aria-label": "Find",
    });
    this.replaceInput = el("input", {
      type: "text",
      placeholder: "Replace",
      spellcheck: "false",
      autocomplete: "off",
      "aria-label": "Replace",
    });
    this.caseBox = el("input", { type: "checkbox", "aria-label": "Case sensitive" });
    this.wordBox = el("input", { type: "checkbox", "aria-label": "Whole word" });
    this.countEl = el("span", { class: "xai-pe-count", text: "0 / 0" });
    this.btnPrev = el("button", { class: "xai-pe-btn", type: "button", text: "Prev" });
    this.btnNext = el("button", { class: "xai-pe-btn", type: "button", text: "Next" });
    this.btnDoReplace = el("button", { class: "xai-pe-btn", type: "button", text: "Replace" });
    this.btnReplaceAll = el("button", { class: "xai-pe-btn", type: "button", text: "Replace All" });
    this.replaceRow = el("div", { class: "xai-pe-search-row" }, [
      this.replaceInput,
      this.btnDoReplace,
      this.btnReplaceAll,
    ]);

    this.searchEl = el("div", { class: "xai-pe-search" }, [
      el("div", { class: "xai-pe-search-row" }, [
        this.findInput,
        this.btnPrev,
        this.btnNext,
        this.countEl,
        el("label", null, [this.caseBox, document.createTextNode("Case")]),
        el("label", null, [this.wordBox, document.createTextNode("Word")]),
      ]),
      this.replaceRow,
    ]);

    this.textarea = el("textarea", {
      class: "xai-pe-textarea",
      spellcheck: "true",
      lang: "en",
      "aria-label": "Prompt editor",
      autocomplete: "off",
      autocorrect: "off",
      autocapitalize: "off",
      wrap: "soft",
    });
    this.textarea.setAttribute("spellcheck", "true");
    this.textarea.setAttribute("lang", "en");

    this.footerView = el("span", { class: "xai-pe-footer-view" });
    this.footerCount = el("span", { class: "xai-pe-footer-count" });
    this.footerEl = el("div", { class: "xai-pe-footer" }, [this.footerView, this.footerCount]);

    const root = el("div", { class: "xai-pe" }, [
      toolbar,
      this.searchEl,
      el("div", { class: "xai-pe-editor-wrap" }, [this.textarea]),
      this.footerEl,
    ]);

    for (const btn of [
      this.statusEl,
      this.btnFind,
      this.btnReplace,
      this.btnCopy,
      this.btnPaste,
      this.btnPrev,
      this.btnNext,
      this.btnDoReplace,
      this.btnReplaceAll,
      this.btnLastManual,
      this.btnLastLlm,
      this.btnUseCurrent,
    ]) {
      btn.addEventListener("mousedown", (e) => e.preventDefault());
    }
    this.statusEl.addEventListener("click", () => this.toggleSourceMode());
    this.btnFind.addEventListener("click", () => this.toggleSearch(false));
    this.btnReplace.addEventListener("click", () => this.toggleSearch(true));
    this.btnCopy.addEventListener("click", () => this.copyDisplayed());
    this.btnPaste.addEventListener("click", (e) => this.pasteReplace({ append: e.shiftKey }));
    this.btnUseCurrent.addEventListener("click", () => this.useAsCurrent());
    this.btnLastManual.addEventListener("click", () => this.toggleHistory(VIEW.LAST_MANUAL));
    this.btnLastLlm.addEventListener("click", () => this.toggleHistory(VIEW.LAST_LLM));
    this.btnPrev.addEventListener("click", () => this.gotoMatch(-1));
    this.btnNext.addEventListener("click", () => this.gotoMatch(1));
    this.btnDoReplace.addEventListener("click", () => this.replaceCurrent());
    this.btnReplaceAll.addEventListener("click", () => this.replaceAll());
    this.findInput.addEventListener("input", () => this.recomputeMatches(true, { select: false }));
    this.caseBox.addEventListener("change", () => this.recomputeMatches(true, { select: false }));
    this.wordBox.addEventListener("change", () => this.recomputeMatches(true, { select: false }));
    this.findInput.addEventListener("keydown", (e) => this._onFindKey(e));
    this.replaceInput.addEventListener("keydown", (e) => this._onFindKey(e));
    for (const field of [this.findInput, this.replaceInput]) {
      field.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        field.focus();
      });
      field.addEventListener("mousedown", (e) => e.stopPropagation());
    }

    this.textarea.addEventListener("input", () => this._onEditorInput());
    this.textarea.addEventListener("dblclick", () => this._onEditorDblClick());
    this.textarea.addEventListener("keydown", (e) => this._onEditorKey(e));
    this.textarea.addEventListener("wheel", (e) => this._onEditorWheel(e), { passive: false });
    this.textarea.addEventListener("paste", (e) => this._onEditorPaste(e));
    this._bindDrop(root);
    this._bindDrop(this.textarea);

    root.addEventListener("keydown", (e) => e.stopPropagation());
    root.addEventListener("pointerdown", (e) => e.stopPropagation());
    root.addEventListener("mousedown", (e) => e.stopPropagation());
    for (const type of ["paste", "copy", "cut"]) {
      root.addEventListener(type, (e) => e.stopPropagation());
    }

    return root;
  }

  _listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push(() => target.removeEventListener(type, handler, options));
  }

  _bindNode() {
    const node = this.node;
    const self = this;

    const prevExecuted = node.onExecuted;
    node.onExecuted = function (output) {
      prevExecuted?.apply(this, arguments);
      self.onExecuted(output);
    };

    const prevConnections = node.onConnectionsChange;
    node.onConnectionsChange = function () {
      const r = prevConnections?.apply(this, arguments);
      self.refreshConnectionStatus();
      self.render();
      return r;
    };

    const prevConfigure = node.onAfterGraphConfigured;
    node.onAfterGraphConfigured = function () {
      prevConfigure?.apply(this, arguments);
      self._syncFromWidgets();
      self.refreshConnectionStatus();
      self.render();
    };

    const prevRemoved = node.onRemoved;
    node.onRemoved = function () {
      self.dispose();
      prevRemoved?.apply(this, arguments);
    };

    for (const name of ["current_prompt", "last_manual_input", "last_llm_input", "source_mode"]) {
      hideWidget(getWidget(node, name));
    }

    const widget = node.addDOMWidget("prompt_editor_ui", "xai_prompt_editor", this.root, {
      serialize: false,
      hideOnZoom: true,
      getMinHeight: () => 160,
      getValue: () => getWidgetValue(node, "current_prompt"),
      setValue: () => {},
      afterResize() {
        self._fitEditor();
      },
      beforeResize() {
        self._fitEditor();
      },
    });
    widget.serialize = false;
    if (!widget.options) widget.options = {};
    widget.options.serialize = false;
    widget.options.minNodeSize = [420, 260];
    widget.serializeValue = () => undefined;
    this.domWidget = widget;

    if (!node.size || node.size[0] < 420) {
      node.setSize?.([Math.max(node.size?.[0] || 0, 420), Math.max(node.size?.[1] || 0, 300)]);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.copyTimer) window.clearTimeout(this.copyTimer);
    if (this.pasteTimer) window.clearTimeout(this.pasteTimer);
    if (this._pulseTimer) window.clearTimeout(this._pulseTimer);
    for (const off of this._listeners) {
      try {
        off();
      } catch {
        /* ignore */
      }
    }
    this._listeners = [];
  }

  _fitEditor() {
    const node = this.node;
    if (!node?.size || !this.root) return;
    const used =
      (this.statusEl?.offsetHeight || 22) +
      (this.searchEl?.classList.contains("is-open") ? this.searchEl.offsetHeight + 4 : 0) +
      (this.footerEl?.offsetHeight || 14) +
      16;
    const h = Math.max(80, (node.size[1] || 300) - used - 40);
    this.textarea.style.height = `${h}px`;
  }

  sourceMode() {
    const saved = getWidgetValue(this.node, "source_mode");
    return saved === "LLM" ? "LLM" : "MANUAL";
  }

  _setSourceMode(mode) {
    setWidgetValue(this.node, "source_mode", mode === "LLM" ? "LLM" : "MANUAL");
  }

  displayedText() {
    if (this.viewMode === VIEW.LAST_MANUAL) return getWidgetValue(this.node, "last_manual_input");
    if (this.viewMode === VIEW.LAST_LLM) return getWidgetValue(this.node, "last_llm_input");
    if (this.sourceMode() === "LLM" && this._hasLlmValue) {
      return getWidgetValue(this.node, "last_llm_input");
    }
    return getWidgetValue(this.node, "current_prompt");
  }

  isEditable() {
    if (this.viewMode === VIEW.CURRENT) return this.sourceMode() === "MANUAL";
    return this.historyUnlocked;
  }

  refreshConnectionStatus(opts = {}) {
    const connected = isTextConnected(this.node);
    const wasConnected = this._connected;
    this._connected = connected;
    if (!connected) {
      this._setSourceMode("MANUAL");
    } else if (opts.fromLoad) {
      const saved = getWidgetValue(this.node, "source_mode");
      if (saved !== "MANUAL" && saved !== "LLM") this._setSourceMode("LLM");
    } else if (!wasConnected && connected) {
      this._setSourceMode("LLM");
    }
    if (opts.fromLoad) {
      if (getWidgetValue(this.node, "last_llm_input") !== "") this._hasLlmValue = true;
      if (getWidgetValue(this.node, "last_manual_input") !== "") this._hasManualValue = true;
    }
    if (this.viewMode === VIEW.CURRENT && !this._syncingEditor) {
      this._writeEditor(this.displayedText());
    }
  }

  toggleSourceMode() {
    if (!isTextConnected(this.node)) return;
    const next = this.sourceMode() === "LLM" ? "MANUAL" : "LLM";
    this._setSourceMode(next);
    if (this.viewMode === VIEW.CURRENT) this._writeEditor(this.displayedText());
    this.node.setDirtyCanvas?.(true, true);
    this.render();
  }

  _syncFromWidgets() {
    this._writeEditor(this.displayedText());
  }

  _writeEditor(text) {
    this._syncingEditor = true;
    if (this.textarea.value !== text) this.textarea.value = text ?? "";
    this._syncingEditor = false;
    this._updateFooter();
  }

  _onEditorInput() {
    if (this._syncingEditor || !this.isEditable()) {
      if (!this.isEditable()) this._writeEditor(this.displayedText());
      return;
    }
    const value = this.textarea.value;
    if (this.viewMode === VIEW.CURRENT) {
      setWidgetValue(this.node, "current_prompt", value);
      setWidgetValue(this.node, "last_manual_input", value);
      this._hasManualValue = true;
    } else if (this.viewMode === VIEW.LAST_MANUAL) {
      setWidgetValue(this.node, "last_manual_input", value);
      this._hasManualValue = true;
    } else if (this.viewMode === VIEW.LAST_LLM) {
      setWidgetValue(this.node, "last_llm_input", value);
      this._hasLlmValue = true;
    }
    this._updateFooter();
    if (this.searchOpen) this.recomputeMatches(false, { select: false });
    this.node.setDirtyCanvas?.(true, true);
  }

  _onEditorDblClick() {
    if (this.viewMode === VIEW.CURRENT) return;
    this.historyUnlocked = true;
    this.render();
  }

  _onEditorKey(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      this.openSearch(false);
      return;
    }
    if (ctrl && (e.key === "h" || e.key === "H")) {
      e.preventDefault();
      this.openSearch(true);
      return;
    }
    if (ctrl && e.shiftKey && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      this.pasteReplace();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (this.searchOpen) {
        this.closeSearch();
        return;
      }
      if (this.viewMode !== VIEW.CURRENT) {
        this.viewMode = VIEW.CURRENT;
        this.historyUnlocked = false;
        this._writeEditor(this.displayedText());
        this.render();
      }
    }
  }

  _onEditorWheel(e) {
    const ta = this.textarea;
    if (!ta) return;
    const atTop = ta.scrollTop <= 0 && e.deltaY < 0;
    const atBottom = ta.scrollTop + ta.clientHeight >= ta.scrollHeight - 1 && e.deltaY > 0;
    if (!atTop && !atBottom) e.stopPropagation();
  }

  _onFindKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.target === this.replaceInput && this.isEditable() && !e.shiftKey) {
        this.replaceCurrent({ keepSearchFocus: true });
      } else {
        this.gotoMatch(e.shiftKey ? -1 : 1);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (this.searchOpen) {
        this.closeSearch();
        if (this.isEditable()) this.textarea.focus();
        return;
      }
      if (this.viewMode !== VIEW.CURRENT) {
        this.viewMode = VIEW.CURRENT;
        this.historyUnlocked = false;
        this._writeEditor(this.displayedText());
        this.render();
      }
    }
  }

  toggleHistory(mode) {
    if (mode === VIEW.LAST_MANUAL && !this._hasManualValue && this.viewMode !== VIEW.LAST_MANUAL) return;
    if (mode === VIEW.LAST_LLM && !this._hasLlmValue && this.viewMode !== VIEW.LAST_LLM) return;
    if (this.viewMode === mode) {
      this.viewMode = VIEW.CURRENT;
      this.historyUnlocked = false;
    } else {
      this.viewMode = mode;
      this.historyUnlocked = false;
    }
    this._writeEditor(this.displayedText());
    if (this.searchOpen) this.recomputeMatches(true, { select: false });
    this.render();
  }

  onExecuted(output) {
    const text = extractExecutedText(output);
    if (text == null) return;
    if (this.sourceMode() === "LLM") {
      setWidgetValue(this.node, "current_prompt", text);
      setWidgetValue(this.node, "last_llm_input", text);
      this._hasLlmValue = true;
      this._pulseLlmLight();
      if (this.viewMode === VIEW.CURRENT) this._writeEditor(text);
      else if (this.viewMode === VIEW.LAST_LLM && !this.historyUnlocked) {
        this._writeEditor(getWidgetValue(this.node, "last_llm_input"));
      }
    }
    this.node.setDirtyCanvas?.(true, true);
    this.render();
  }

  toggleSearch(withReplace) {
    const wantReplace = !!withReplace;
    if (this.searchOpen && this.replaceOpen === wantReplace) {
      this.closeSearch();
      return;
    }
    this.openSearch(wantReplace);
  }

  openSearch(withReplace) {
    this.searchOpen = true;
    this.replaceOpen = !!withReplace;
    this.searchEl.classList.add("is-open");
    this._updateSearchChrome();
    this._fitEditor();
    this.recomputeMatches(true, { select: false });
    const focusEl = this.replaceOpen && this.findInput.value ? this.replaceInput : this.findInput;
    focusEl.focus();
    if (focusEl === this.findInput) this.findInput.select();
  }

  closeSearch() {
    this.searchOpen = false;
    this.replaceOpen = false;
    this.searchEl.classList.remove("is-open");
    this.matches = [];
    this.matchIndex = -1;
    this._updateSearchChrome();
    this._fitEditor();
  }

  _updateSearchChrome() {
    this.replaceRow.style.display = this.searchOpen && this.replaceOpen ? "flex" : "none";
    this.btnFind.classList.toggle("is-active", this.searchOpen && !this.replaceOpen);
    this.btnReplace.classList.toggle("is-active", this.searchOpen && this.replaceOpen);
    this._updateReplaceEnabled();
  }

  recomputeMatches(resetIndex, opts = {}) {
    const select = !!opts.select;
    const query = this.findInput.value;
    this.matches = findMatches(this.textarea.value, query, this.caseBox.checked, this.wordBox.checked);
    if (resetIndex) this.matchIndex = this.matches.length ? 0 : -1;
    else if (this.matchIndex >= this.matches.length) this.matchIndex = this.matches.length - 1;
    this._updateMatchUi();
    if (select && this.matchIndex >= 0) this._selectMatch(this.matchIndex);
  }

  gotoMatch(delta) {
    if (!this.matches.length) {
      this.recomputeMatches(true, { select: true });
      return;
    }
    this.matchIndex = (this.matchIndex + delta + this.matches.length) % this.matches.length;
    this._selectMatch(this.matchIndex);
    this._updateMatchUi();
  }

  _selectMatch(index) {
    const pair = this.matches[index];
    if (!pair) return;
    const [start, end] = pair;
    this.textarea.focus({ preventScroll: true });
    this.textarea.setSelectionRange(start, end);
  }

  _updateMatchUi() {
    const total = this.matches.length;
    const current = total ? this.matchIndex + 1 : 0;
    this.countEl.textContent = `${current} / ${total}`;
    this._updateReplaceEnabled();
  }

  _updateReplaceEnabled() {
    const allowed = this.isEditable() && this.replaceOpen;
    this.btnDoReplace.disabled = !allowed;
    this.btnReplaceAll.disabled = !allowed;
    this.replaceInput.disabled = false;
    this.replaceInput.readOnly = false;
    let why = "Replacement text";
    if (this.replaceOpen && !this.isEditable()) {
      why =
        this.viewMode === VIEW.CURRENT
          ? "Replace is unavailable while a connected STRING is the active value. Find still works."
          : "Double-click the editor to unlock this history copy before replacing.";
    }
    this.replaceInput.title = why;
    this.btnDoReplace.title = why;
    this.btnReplaceAll.title = why;
  }

  _replaceRange(start, end, replacement) {
    const ta = this.textarea;
    ta.focus();
    ta.setSelectionRange(start, end);
    let usedNative = false;
    try {
      usedNative = document.execCommand("insertText", false, replacement);
    } catch {
      usedNative = false;
    }
    if (!usedNative) {
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      ta.value = before + replacement + after;
      const caret = start + replacement.length;
      ta.setSelectionRange(caret, caret);
      this._onEditorInput();
    }
  }

  replaceCurrent(opts = {}) {
    if (!this.isEditable()) return;
    if (!this.matches.length) this.recomputeMatches(true, { select: false });
    if (!this.matches.length) return;
    const [start, end] = this.matches[this.matchIndex] || this.matches[0];
    this._replaceRange(start, end, this.replaceInput.value);
    this.recomputeMatches(false, { select: !opts.keepSearchFocus });
    if (opts.keepSearchFocus) this.replaceInput.focus();
  }

  replaceAll() {
    if (!this.isEditable()) return;
    const query = this.findInput.value;
    if (!query) return;
    const replacement = this.replaceInput.value;
    const text = this.textarea.value;
    const matches = findMatches(text, query, this.caseBox.checked, this.wordBox.checked);
    if (!matches.length) return;
    let out = "";
    let last = 0;
    for (const [start, end] of matches) {
      out += text.slice(last, start);
      out += replacement;
      last = end;
    }
    out += text.slice(last);
    this.textarea.value = out;
    this._onEditorInput();
    this.recomputeMatches(true);
  }

  async copyDisplayed() {
    const text = this.textarea.value;
    const ok = await copyExact(text);
    if (!ok) return;
    this.btnCopy.textContent = "✓ Copied";
    if (this.copyTimer) window.clearTimeout(this.copyTimer);
    this.copyTimer = window.setTimeout(() => {
      this.btnCopy.textContent = "Copy";
    }, 900);
  }

  _onEditorPaste(e) {
    e.stopPropagation();
    const plain = e.clipboardData?.getData("text/plain") ?? "";
    const html = e.clipboardData?.getData("text/html") ?? "";
    const text = pickClipboardText(plain, html);
    if (!text) {
      e.preventDefault();
      return;
    }
    if (text !== plain) {
      e.preventDefault();
      if (this.isEditable()) this._applyEditorText(text);
    }
  }

  async pasteReplace(opts = {}) {
    if (!this.isEditable()) return;
    let text = await readClipboardPlainText();
    if (!text) text = await readOsClipboardViaCapture();
    if (!text) {
      this.btnPaste.textContent = "No text";
      if (this.pasteTimer) window.clearTimeout(this.pasteTimer);
      this.pasteTimer = window.setTimeout(() => {
        this.btnPaste.textContent = "Paste";
      }, 1400);
      return;
    }
    this._applyEditorText(text, { append: !!opts.append });
    this._pasteFeedback(!!opts.append);
  }

  _pasteFeedback(append) {
    this.btnPaste.textContent = append ? "✓ Appended" : "✓ Pasted";
    if (this.pasteTimer) window.clearTimeout(this.pasteTimer);
    this.pasteTimer = window.setTimeout(() => {
      this.btnPaste.textContent = "Paste";
    }, 900);
  }

  _applyEditorText(text, opts = {}) {
    const ta = this.textarea;
    const next = text == null ? "" : String(text);
    ta.focus();
    let ok = false;
    try {
      if (opts.append) {
        const pos = ta.value.length;
        ta.setSelectionRange(pos, pos);
        ok = document.execCommand("insertText", false, next);
      } else if (next === "") {
        ta.setSelectionRange(0, ta.value.length);
        ok = document.execCommand("delete");
      } else {
        ta.setSelectionRange(0, ta.value.length);
        ok = document.execCommand("insertText", false, next);
      }
    } catch {
      ok = false;
    }
    if (!ok) ta.value = opts.append ? ta.value + next : next;
    this._onEditorInput();
  }

  useAsCurrent() {
    if (this.viewMode === VIEW.CURRENT) return;
    const text = this.displayedText();
    this._setSourceMode("MANUAL");
    this.viewMode = VIEW.CURRENT;
    this.historyUnlocked = false;
    setWidgetValue(this.node, "current_prompt", text);
    setWidgetValue(this.node, "last_manual_input", text);
    this._hasManualValue = true;
    this._writeEditor(text);
    this.node.setDirtyCanvas?.(true, true);
    this.render();
  }

  _pulseLlmLight() {
    if (!this.statusLight) return;
    this.statusLight.classList.remove("is-pulse");
    void this.statusLight.offsetWidth;
    this.statusLight.classList.add("is-pulse");
    if (this._pulseTimer) window.clearTimeout(this._pulseTimer);
    this._pulseTimer = window.setTimeout(() => {
      this.statusLight.classList.remove("is-pulse");
    }, 700);
  }

  _bindDrop(target) {
    target.addEventListener("dragover", (e) => {
      if (!this._dropHasText(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = this.isEditable() ? "copy" : "none";
    });
    target.addEventListener("drop", (e) => {
      if (!this._dropHasText(e)) return;
      e.preventDefault();
      e.stopPropagation();
      this._handleDrop(e);
    });
  }

  _dropHasText(e) {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    const list = Array.from(types);
    return list.includes("Files") || list.includes("text/plain") || list.includes("text/uri-list");
  }

  async _handleDrop(e) {
    if (!this.isEditable()) return;
    const dt = e.dataTransfer;
    if (!dt) return;
    const file = dt.files && dt.files[0];
    if (file) {
      if (!this._isTextFile(file)) return;
      const text = await file.text();
      this._applyEditorText(text);
      return;
    }
    const plain = dt.getData("text/plain");
    if (plain && !isClipboardFilePathJunk(plain)) this._applyEditorText(plain);
  }

  _isTextFile(file) {
    const name = (file.name || "").toLowerCase();
    const type = (file.type || "").toLowerCase();
    if (type.startsWith("text/")) return true;
    return /\.(txt|md|csv|json|prompt|text)$/.test(name);
  }

  _updatePasteEnabled() {
    const allowed = this.isEditable();
    this.btnPaste.disabled = !allowed;
    this.btnPaste.title = allowed
      ? "Replace the displayed text with the clipboard. Shift+click appends. Ctrl+Shift+V replaces."
      : this.viewMode === VIEW.CURRENT
        ? "Paste is unavailable while LLM mode is active. Click MANUAL to edit locally."
        : "Double-click the editor to unlock this history copy before pasting.";
  }

  _updateHistoryButtons() {
    this.btnLastManual.disabled = !this._hasManualValue && this.viewMode !== VIEW.LAST_MANUAL;
    this.btnLastLlm.disabled = !this._hasLlmValue && this.viewMode !== VIEW.LAST_LLM;
    this.btnLastManual.title = this.btnLastManual.disabled
      ? "No last manual prompt stored yet."
      : "View stored last manual prompt. Does not change connections, status, or active output.";
    this.btnLastLlm.title = this.btnLastLlm.disabled
      ? "No last LLM prompt stored yet."
      : "View stored last connected STRING. Does not change connections, status, or active output.";
    const inHistory = this.viewMode !== VIEW.CURRENT;
    this.btnUseCurrent.hidden = !inHistory;
    this.btnUseCurrent.disabled = !inHistory;
  }

  _updateFooter() {
    const text = this.textarea.value;
    const mode = this.sourceMode();
    let viewing;
    if (this.viewMode === VIEW.LAST_MANUAL) viewing = "Viewing last manual";
    else if (this.viewMode === VIEW.LAST_LLM) viewing = "Viewing last LLM";
    else if (mode === "LLM") viewing = "Viewing current LLM";
    else viewing = "Editing current";
    const output = mode === "LLM" ? "Output is LLM" : "Output is MANUAL";
    this.footerView.textContent = `${viewing} · ${output}`;
    this.footerCount.textContent = `${countWords(text)} words · ${text.length} chars`;
  }

  render() {
    const mode = this.sourceMode();
    const connected = isTextConnected(this.node);
    this.statusEl.dataset.mode = mode;
    this.statusEl.dataset.light = mode === "LLM" ? "on" : connected ? "idle" : "off";
    this.statusLabel.textContent = mode;
    this.statusEl.disabled = !connected;
    if (!connected) {
      this.statusEl.title = "Connect a STRING to use LLM mode.";
    } else if (mode === "LLM") {
      this.statusEl.title = "Using connected STRING. Click to edit locally without disconnecting.";
    } else {
      this.statusEl.title = "Using local text. Cable still connected — click to use LLM.";
    }

    const editable = this.isEditable();
    this.textarea.readOnly = !editable;
    this.textarea.classList.toggle("is-readonly", !editable);
    this.textarea.classList.toggle("is-history-unlocked", this.viewMode !== VIEW.CURRENT && this.historyUnlocked);

    this.btnLastManual.classList.toggle("is-history-active", this.viewMode === VIEW.LAST_MANUAL);
    this.btnLastLlm.classList.toggle("is-history-active", this.viewMode === VIEW.LAST_LLM);
    this._updateSearchChrome();
    this._updatePasteEnabled();
    this._updateHistoryButtons();

    if (this.viewMode !== VIEW.CURRENT && !editable) {
      this.textarea.title = "History is read-only. Double-click to unlock this stored copy.";
    } else if (this.viewMode === VIEW.CURRENT && mode === "LLM") {
      this.textarea.title = "Connected STRING is the active graph value. Click MANUAL to edit locally without disconnecting.";
    } else {
      this.textarea.title = "";
    }

    this._updateFooter();
    this._updateReplaceEnabled();
    this._fitEditor();
  }
}

function isPromptEditorNode(node) {
  return !!(node && (node.comfyClass === NODE_ID || node.constructor?.comfyClass === NODE_ID || node.type === NODE_ID));
}

app.registerExtension({
  name: EXTENSION_NAME,
  async setup() {
    injectCss();
  },
  async nodeCreated(node) {
    if (!isPromptEditorNode(node)) return;
    if (node.__xaiPeRev === UI_REV && node.__xaiPromptEditor) return;
    node.__xaiPromptEditor = new PromptEditorController(node);
    node.__xaiPeRev = UI_REV;
  },
  loadedGraphNode(node) {
    const ctl = node?.__xaiPromptEditor;
    if (!ctl) return;
    ctl._syncFromWidgets();
    ctl.refreshConnectionStatus({ fromLoad: true });
    ctl.render();
  },
  async afterConfigureGraph() {
    const nodes = app.graph?._nodes || app.graph?.nodes || [];
    for (const node of nodes) {
      const ctl = node?.__xaiPromptEditor;
      if (!ctl) continue;
      ctl._syncFromWidgets();
      ctl.refreshConnectionStatus({ fromLoad: true });
      ctl.render();
    }
  },
});
