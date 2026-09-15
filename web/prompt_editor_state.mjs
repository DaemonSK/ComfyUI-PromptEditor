export const VIEW = Object.freeze({
  CURRENT: "CURRENT",
  LAST_MANUAL: "LAST_MANUAL",
  LAST_LLM: "LAST_LLM",
});

const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

export function isWordChar(ch) {
  return typeof ch === "string" && ch.length > 0 && WORD_CHARACTER.test(ch);
}

export function findMatches(text, query, caseSensitive, wholeWord) {
  if (!query || text == null) return [];
  const hay = caseSensitive ? text : text.toLocaleLowerCase();
  const needle = caseSensitive ? query : query.toLocaleLowerCase();
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

export function countWords(text) {
  if (!text) return 0;
  const parts = text.trim().split(/\s+/);
  return parts[0] ? parts.length : 0;
}

export function isClipboardFilePathJunk(text) {
  const candidate = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (!candidate) return true;
  if (/ScreenClip/i.test(candidate)) return true;
  if (/[\\/]TempState[\\/]/i.test(candidate)) return true;
  if (/MicrosoftWindows\.Client/i.test(candidate)) return true;
  if (/\{[0-9A-Fa-f-]{36}\}/.test(candidate) && /\.png/i.test(candidate)) return true;
  if (/^[a-zA-Z]:[\\/].+\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(candidate)) return true;
  if (/^file:\/\/.+\.(png|jpe?g|gif|webp|bmp)/i.test(candidate)) return true;
  if (/^\/.+\.(png|jpe?g|gif|webp|bmp)$/i.test(candidate) && !candidate.includes(" ")) return true;
  return false;
}

export function pickClipboardText(plain, html, convertHtml) {
  if (plain && !isClipboardFilePathJunk(plain)) return plain;
  const fromHtml = html && convertHtml ? convertHtml(html) : "";
  if (fromHtml && !isClipboardFilePathJunk(fromHtml)) return fromHtml;
  return null;
}

export function historyAvailable(serializedFlag, value) {
  return serializedFlag === true || value !== "";
}

export function applyExecutedText(state, executedMode, text) {
  if (executedMode !== "LLM") return { ...state };
  return {
    ...state,
    lastLlmInput: text,
    hasLastLlm: true,
    currentPrompt: state.currentMode === "LLM" ? text : state.currentPrompt,
  };
}
