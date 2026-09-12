"""Sequence A/B/C and empty-value tests for Prompt Editor state semantics."""

from __future__ import annotations

import unittest

from prompt_editor_state import (
    PromptEditorState,
    count_chars,
    count_words,
    find_matches,
    replace_all,
)


class SequenceATests(unittest.TestCase):
    def test_manual_then_llm_then_disconnect_keeps_last_current(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        self.assertEqual(s.status(), "MANUAL")
        self.assertEqual(s.active_output(), "A")
        self.assertEqual(s.last_manual_input, "A")

        s.on_connect()
        self.assertEqual(s.status(), "LLM")
        self.assertEqual(s.current_prompt, "A")
        self.assertEqual(s.last_manual_input, "A")

        s.on_llm_resolved("B")
        s.on_llm_resolved("C")
        self.assertEqual(s.current_prompt, "C")
        self.assertEqual(s.last_llm_input, "C")
        self.assertEqual(s.last_manual_input, "A")
        self.assertEqual(s.active_output(), "C")

        s.on_disconnect()
        self.assertEqual(s.status(), "MANUAL")
        self.assertEqual(s.displayed_text(), "C")
        self.assertEqual(s.current_prompt, "C")
        self.assertEqual(s.last_manual_input, "A")
        self.assertEqual(s.last_llm_input, "C")
        self.assertTrue(s.is_editable())

        s.on_manual_edit("D")
        self.assertEqual(s.current_prompt, "D")
        self.assertEqual(s.last_manual_input, "D")
        self.assertEqual(s.last_llm_input, "C")
        self.assertEqual(s.active_output(), "D")


class SequenceBTests(unittest.TestCase):
    def test_history_view_does_not_change_status_or_output(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        s.on_connect()
        s.on_llm_resolved("B")

        s.toggle_last_manual()
        self.assertEqual(s.displayed_text(), "A")
        self.assertEqual(s.status(), "LLM")
        self.assertEqual(s.active_output(), "B")
        self.assertEqual(s.view_mode, "LAST_MANUAL")
        self.assertFalse(s.is_editable())

        s.unlock_history_edit()
        self.assertTrue(s.is_editable())
        s.on_manual_edit("A2")
        self.assertEqual(s.displayed_text(), "A2")
        self.assertEqual(s.last_manual_input, "A2")
        self.assertEqual(s.active_output(), "B")
        self.assertEqual(s.current_prompt, "B")
        self.assertEqual(s.status(), "LLM")

        s.toggle_last_manual()
        self.assertEqual(s.view_mode, "CURRENT")
        self.assertEqual(s.displayed_text(), "B")
        self.assertEqual(s.status(), "LLM")
        self.assertEqual(s.active_output(), "B")
        self.assertFalse(s.history_unlocked)


class SequenceCTests(unittest.TestCase):
    def test_manual_viewing_last_llm_does_not_change_output(self):
        s = PromptEditorState()
        s.on_manual_edit("X")
        s.on_connect()
        s.on_llm_resolved("Y")
        s.on_disconnect()
        s.on_manual_edit("X")

        s.toggle_last_llm()
        self.assertEqual(s.displayed_text(), "Y")
        self.assertEqual(s.status(), "MANUAL")
        self.assertEqual(s.active_output(), "X")
        self.assertFalse(s.is_editable())

        s.unlock_history_edit()
        s.on_manual_edit("Y2")
        self.assertEqual(s.last_llm_input, "Y2")
        self.assertEqual(s.active_output(), "X")
        self.assertEqual(s.current_prompt, "X")
        self.assertEqual(s.status(), "MANUAL")

        s.exit_history()
        self.assertEqual(s.displayed_text(), "X")
        self.assertEqual(s.active_output(), "X")


class ExtraSemanticsTests(unittest.TestCase):
    def test_history_buttons_switch_not_stack(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        s.on_connect()
        s.on_llm_resolved("B")
        s.toggle_last_manual()
        s.toggle_last_llm()
        self.assertEqual(s.view_mode, "LAST_LLM")
        self.assertEqual(s.displayed_text(), "B")
        self.assertEqual(s.status(), "LLM")
        self.assertEqual(s.active_output(), "B")

    def test_connect_does_not_wipe_current_before_resolve(self):
        s = PromptEditorState()
        s.on_manual_edit("keep me")
        s.on_connect()
        self.assertEqual(s.current_prompt, "keep me")
        self.assertEqual(s.last_manual_input, "keep me")
        self.assertEqual(s.status(), "LLM")
        self.assertFalse(s.is_editable())

    def test_empty_string_is_valid(self):
        s = PromptEditorState()
        s.on_manual_edit("")
        self.assertEqual(s.current_prompt, "")
        self.assertEqual(s.active_output(), "")
        s.on_connect()
        s.on_llm_resolved("")
        self.assertEqual(s.current_prompt, "")
        self.assertEqual(s.last_llm_input, "")
        self.assertTrue(s.has_last_llm)

    def test_read_only_current_llm_ignores_edits(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        s.on_connect()
        s.on_llm_resolved("B")
        s.on_manual_edit("should not apply")
        self.assertEqual(s.current_prompt, "B")
        self.assertEqual(s.last_manual_input, "A")

    def test_exact_text_preserved(self):
        raw = "  Hello\nWORLD  {lora:foo}  "
        s = PromptEditorState()
        s.on_manual_edit(raw)
        self.assertEqual(s.current_prompt, raw)
        self.assertEqual(s.last_manual_input, raw)

    def test_replace_blocked_in_llm_current(self):
        s = PromptEditorState()
        s.on_connect()
        s.on_llm_resolved("a red dragon")
        self.assertFalse(s.is_replace_allowed())
        count = s.apply_replace_all("red", "blue", case_sensitive=True, whole_word=True)
        self.assertEqual(count, 0)
        self.assertEqual(s.current_prompt, "a red dragon")

    def test_replace_allowed_after_history_unlock(self):
        s = PromptEditorState()
        s.on_manual_edit("a red dragon")
        s.toggle_last_manual()
        self.assertFalse(s.is_replace_allowed())
        s.unlock_history_edit()
        count = s.apply_replace_all("red", "black", case_sensitive=True, whole_word=True)
        self.assertEqual(count, 1)
        self.assertEqual(s.last_manual_input, "a black dragon")
        self.assertEqual(s.current_prompt, "a red dragon")


class ModeToggleTests(unittest.TestCase):
    def test_toggle_to_manual_keeps_cable_and_uses_local_output(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        s.on_connect()
        s.on_llm_resolved("C")
        self.assertTrue(s.connected)
        self.assertEqual(s.status(), "LLM")
        self.assertEqual(s.light(), "on")

        self.assertTrue(s.toggle_source_mode())
        self.assertTrue(s.connected)
        self.assertEqual(s.status(), "MANUAL")
        self.assertEqual(s.light(), "idle")
        self.assertEqual(s.displayed_text(), "C")
        self.assertEqual(s.last_manual_input, "A")
        self.assertTrue(s.is_editable())
        self.assertEqual(s.active_output(), "C")

        s.on_manual_edit("D")
        self.assertEqual(s.current_prompt, "D")
        self.assertEqual(s.last_manual_input, "D")
        self.assertEqual(s.last_llm_input, "C")
        self.assertEqual(s.active_output(), "D")

        self.assertTrue(s.toggle_source_mode())
        self.assertEqual(s.status(), "LLM")
        self.assertEqual(s.light(), "on")
        self.assertEqual(s.displayed_text(), "C")
        self.assertEqual(s.current_prompt, "D")
        self.assertEqual(s.last_manual_input, "D")
        self.assertEqual(s.active_output(), "C")
        self.assertFalse(s.is_editable())

    def test_toggle_without_cable_is_noop(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        self.assertFalse(s.toggle_source_mode())
        self.assertEqual(s.status(), "MANUAL")
        self.assertEqual(s.light(), "off")
        self.assertEqual(s.active_output(), "A")

    def test_history_does_not_change_mode(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        s.on_connect()
        s.on_llm_resolved("B")
        s.toggle_source_mode()
        self.assertEqual(s.status(), "MANUAL")
        s.toggle_last_llm()
        self.assertEqual(s.status(), "MANUAL")
        self.assertEqual(s.active_output(), "B")

    def test_paste_replaces_when_editable(self):
        s = PromptEditorState()
        s.on_manual_edit("old")
        self.assertTrue(s.paste_replace("  new\nclip  "))
        self.assertEqual(s.current_prompt, "  new\nclip  ")
        self.assertEqual(s.last_manual_input, "  new\nclip  ")

    def test_paste_blocked_in_llm_current(self):
        s = PromptEditorState()
        s.on_connect()
        s.on_llm_resolved("keep")
        self.assertFalse(s.paste_replace("nope"))
        self.assertEqual(s.current_prompt, "keep")

    def test_paste_append(self):
        s = PromptEditorState()
        s.on_manual_edit("hello")
        self.assertTrue(s.paste_append(" world"))
        self.assertEqual(s.current_prompt, "hello world")

    def test_use_as_current_from_last_llm(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        s.on_connect()
        s.on_llm_resolved("C")
        s.toggle_last_llm()
        self.assertEqual(s.active_output(), "C")
        self.assertTrue(s.use_as_current())
        self.assertEqual(s.status(), "MANUAL")
        self.assertEqual(s.view_mode, "CURRENT")
        self.assertEqual(s.current_prompt, "C")
        self.assertEqual(s.last_manual_input, "C")
        self.assertEqual(s.last_llm_input, "C")
        self.assertEqual(s.active_output(), "C")
        self.assertTrue(s.is_editable())
        self.assertTrue(s.connected)

    def test_use_as_current_does_not_run_on_current_view(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        self.assertFalse(s.use_as_current())
        self.assertEqual(s.current_prompt, "A")

    def test_empty_history_flags(self):
        s = PromptEditorState()
        self.assertFalse(s.can_open_last_manual())
        self.assertFalse(s.can_open_last_llm())
        s.on_manual_edit("")
        self.assertTrue(s.can_open_last_manual())
        s.on_connect()
        s.on_llm_resolved("")
        self.assertTrue(s.can_open_last_llm())

    def test_footer_context_history_vs_output(self):
        s = PromptEditorState()
        s.on_manual_edit("A")
        s.on_connect()
        s.on_llm_resolved("B")
        s.toggle_last_manual()
        self.assertEqual(s.footer_context(), "Viewing last manual · Output is LLM")
        s.exit_history()
        s.toggle_source_mode()
        self.assertEqual(s.footer_context(), "Editing current · Output is MANUAL")


class FindReplaceTests(unittest.TestCase):
    def test_find_is_literal_not_regex(self):
        text = "a+b a+b aXb"
        matches = find_matches(text, "a+b", case_sensitive=True, whole_word=False)
        self.assertEqual(len(matches), 2)

    def test_case_insensitive(self):
        matches = find_matches("Hello HELLO hello", "hello", case_sensitive=False, whole_word=True)
        self.assertEqual(len(matches), 3)

    def test_whole_word(self):
        matches = find_matches("cat cats cat", "cat", case_sensitive=True, whole_word=True)
        self.assertEqual(len(matches), 2)

    def test_replace_all_preserves_surroundings(self):
        new, n = replace_all("  cat  cat", "cat", "dog", case_sensitive=True, whole_word=True)
        self.assertEqual(n, 2)
        self.assertEqual(new, "  dog  dog")

    def test_word_char_count(self):
        self.assertEqual(count_words(""), 0)
        self.assertEqual(count_words("  "), 0)
        self.assertEqual(count_words("one two  three"), 3)
        self.assertEqual(count_chars("  ab"), 4)


if __name__ == "__main__":
    unittest.main()
