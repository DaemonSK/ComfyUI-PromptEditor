import { app } from "../../scripts/app.js";

const NODE_ID = "XAI_PromptEditor";
const EXTENSION_NAME = "xAI.PromptEditor";
const CSS_ID = "xai-prompt-editor-css";

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
    link.href = new URL("./prompt_editor.css", import.meta.url).href;
  } catch {
    link.href = new URL("prompt_editor.css", import.meta.url).href;
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
    this.disposed = false;
    this._syncingEditor = false;
    this._listeners = [];

    this.root = this._buildDom();
    this._bindNode();
    this._syncFromWidgets();
    this.refreshConnectionStatus();
    this.render();
  }

  _buildDom() {
    this.statusEl = el("div", {
      class: "xai-pe-status",
      role: "status",
      "aria-live": "polite",
      title: "MANUAL: no STRING connected. LLM: a STRING input is connected (any upstream text node).",
    });
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

    const toolbar = el("div", { class: "xai-pe-toolbar" }, [
      this.statusEl,
      this.btnFind,
      this.btnReplace,
      this.btnCopy,
      this.btnLastManual,
      this.btnLastLlm,
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

    this.footerEl = el("div", { class: "xai-pe-footer" });

    const root = el("div", { class: "xai-pe" }, [
      toolbar,
      this.searchEl,
      el("div", { class: "xai-pe-editor-wrap" }, [this.textarea]),
      this.footerEl,
    ]);

    for (const btn of [
      this.btnFind,
      this.btnReplace,
      this.btnCopy,
      this.btnPrev,
      this.btnNext,
      this.btnDoReplace,
      this.btnReplaceAll,
      this.btnLastManual,
      this.btnLastLlm,
    ]) {
      btn.addEventListener("mousedown", (e) => e.preventDefault());
    }
    this.btnFind.addEventListener("click", () => this.toggleSearch(false));
    this.btnReplace.addEventListener("click", () => this.toggleSearch(true));
    this.btnCopy.addEventListener("click", () => this.copyDisplayed());
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

    root.addEventListener("keydown", (e) => e.stopPropagation());
    root.addEventListener("pointerdown", (e) => e.stopPropagation());
    root.addEventListener("mousedown", (e) => e.stopPropagation());

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

    for (const name of ["current_prompt", "last_manual_input", "last_llm_input"]) {
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
    return isTextConnected(this.node) ? "LLM" : "MANUAL";
  }

  displayedText() {
    if (this.viewMode === VIEW.LAST_MANUAL) return getWidgetValue(this.node, "last_manual_input");
    if (this.viewMode === VIEW.LAST_LLM) return getWidgetValue(this.node, "last_llm_input");
    return getWidgetValue(this.node, "current_prompt");
  }

  isEditable() {
    if (this.viewMode === VIEW.CURRENT) return this.sourceMode() === "MANUAL";
    return this.historyUnlocked;
  }

  refreshConnectionStatus() {
    const mode = this.sourceMode();
    this.statusEl.dataset.mode = mode;
    this.statusEl.textContent = mode;
    if (this.viewMode === VIEW.CURRENT && !this._syncingEditor) {
      this._writeEditor(this.displayedText());
    }
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
    } else if (this.viewMode === VIEW.LAST_MANUAL) {
      setWidgetValue(this.node, "last_manual_input", value);
    } else if (this.viewMode === VIEW.LAST_LLM) {
      setWidgetValue(this.node, "last_llm_input", value);
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
    if (e.key === "Escape" && this.searchOpen) {
      e.preventDefault();
      this.closeSearch();
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
      this.closeSearch();
      if (this.isEditable()) this.textarea.focus();
    }
  }

  toggleHistory(mode) {
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
    } else {
      setWidgetValue(this.node, "current_prompt", text);
    }
    if (this.viewMode === VIEW.CURRENT) this._writeEditor(text);
    else if (this.viewMode === VIEW.LAST_LLM && !this.historyUnlocked) this._writeEditor(getWidgetValue(this.node, "last_llm_input"));
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

  _updateFooter() {
    const text = this.textarea.value;
    this.footerEl.textContent = `${countWords(text)} words · ${text.length} chars`;
  }

  render() {
    const mode = this.sourceMode();
    this.statusEl.dataset.mode = mode;
    this.statusEl.textContent = mode;
    this.statusEl.title =
      mode === "LLM"
        ? "STRING input is connected. Status stays LLM while viewing history."
        : "No STRING input connected. Status stays MANUAL while viewing history.";

    const editable = this.isEditable();
    this.textarea.readOnly = !editable;
    this.textarea.classList.toggle("is-readonly", !editable);
    this.textarea.classList.toggle("is-history-unlocked", this.viewMode !== VIEW.CURRENT && this.historyUnlocked);

    this.btnLastManual.classList.toggle("is-history-active", this.viewMode === VIEW.LAST_MANUAL);
    this.btnLastLlm.classList.toggle("is-history-active", this.viewMode === VIEW.LAST_LLM);
    this._updateSearchChrome();

    if (this.viewMode !== VIEW.CURRENT && !editable) {
      this.textarea.title = "History is read-only. Double-click to unlock editing of this stored copy.";
    } else if (this.viewMode === VIEW.CURRENT && mode === "LLM") {
      this.textarea.title = "Connected STRING is the active graph value. Select and copy freely; editing is locked.";
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
    if (node.__xaiPromptEditor) return;
    node.__xaiPromptEditor = new PromptEditorController(node);
  },
  loadedGraphNode(node) {
    const ctl = node?.__xaiPromptEditor;
    if (!ctl) return;
    ctl._syncFromWidgets();
    ctl.refreshConnectionStatus();
    ctl.render();
  },
  async afterConfigureGraph() {
    const nodes = app.graph?._nodes || app.graph?.nodes || [];
    for (const node of nodes) {
      const ctl = node?.__xaiPromptEditor;
      if (!ctl) continue;
      ctl._syncFromWidgets();
      ctl.refreshConnectionStatus();
      ctl.render();
    }
  },
});
