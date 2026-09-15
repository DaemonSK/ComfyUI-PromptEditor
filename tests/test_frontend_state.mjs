import assert from "node:assert/strict";
import test from "node:test";

import {
  applyExecutedText,
  countWords,
  findMatches,
  historyAvailable,
  isClipboardFilePathJunk,
  pickClipboardText,
} from "../web/prompt_editor_state.mjs";

test("whole-word matching treats Unicode letters as word characters", () => {
  assert.deepEqual(findMatches("écat cat 猫cat", "cat", true, true), [[5, 8]]);
});

test("matching is literal and case-insensitive when requested", () => {
  assert.equal(findMatches("A+B a+b axb", "a+b", false, false).length, 2);
});

test("word count follows visible whitespace-separated text", () => {
  assert.equal(countWords("  one\n two  three "), 3);
});

test("empty history survives when its serialized presence flag is true", () => {
  assert.equal(historyAvailable(true, ""), true);
  assert.equal(historyAvailable(false, ""), false);
  assert.equal(historyAvailable(false, "legacy"), true);
});

test("late LLM result is recorded without replacing current manual text", () => {
  const next = applyExecutedText(
    { currentMode: "MANUAL", currentPrompt: "local", lastLlmInput: "old", hasLastLlm: true },
    "LLM",
    "late result",
  );
  assert.equal(next.currentPrompt, "local");
  assert.equal(next.lastLlmInput, "late result");
  assert.equal(next.hasLastLlm, true);
});

test("LLM result becomes current while LLM mode is still active", () => {
  const next = applyExecutedText(
    { currentMode: "LLM", currentPrompt: "old", lastLlmInput: "old", hasLastLlm: true },
    "LLM",
    "new",
  );
  assert.equal(next.currentPrompt, "new");
  assert.equal(next.lastLlmInput, "new");
});

test("manual execution is never misclassified as LLM history", () => {
  const state = { currentMode: "LLM", currentPrompt: "manual", lastLlmInput: "old", hasLastLlm: true };
  assert.deepEqual(applyExecutedText(state, "MANUAL", "manual"), state);
});

test("clipboard filtering preserves accepted whitespace and rejects screenshot paths", () => {
  assert.equal(pickClipboardText("  prompt\n", "", () => ""), "  prompt\n");
  assert.equal(
    isClipboardFilePathJunk("C:\\TempState\\ScreenClip\\{804F6E43-E065-41BA-A403-D20472527A55}.png"),
    true,
  );
  assert.equal(pickClipboardText("", "<b>x</b>", () => "  rich text  "), "  rich text  ");
});
