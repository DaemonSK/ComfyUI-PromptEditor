"""Pure state machine for Prompt Editor semantics.

This module has no ComfyUI dependency. The frontend JavaScript mirrors these
rules; the backend only pass-throughs the active STRING. Tests in
``tests/test_state_machine.py`` lock the sequences from the product spec.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

SourceMode = Literal["MANUAL", "LLM"]
ViewMode = Literal["CURRENT", "LAST_MANUAL", "LAST_LLM"]


def count_words(text: str) -> int:
    if not text:
        return 0
    parts = text.split()
    return len(parts)


def count_chars(text: str) -> int:
    return len(text)


@dataclass
class PromptEditorState:
    current_prompt: str = ""
    last_manual_input: str = ""
    last_llm_input: str = ""
    source_mode: SourceMode = "MANUAL"
    view_mode: ViewMode = "CURRENT"
    history_unlocked: bool = False
    has_last_manual: bool = False
    has_last_llm: bool = False
    connected: bool = False

    def status(self) -> SourceMode:
        """MANUAL/LLM is the active mode. History viewing never changes this."""
        return self.source_mode

    def light(self) -> str:
        """on = using LLM, idle = cable present but MANUAL, off = no cable."""
        if self.source_mode == "LLM":
            return "on"
        if self.connected:
            return "idle"
        return "off"

    def can_toggle_mode(self) -> bool:
        return self.connected

    def displayed_text(self) -> str:
        if self.view_mode == "LAST_MANUAL":
            return self.last_manual_input
        if self.view_mode == "LAST_LLM":
            return self.last_llm_input
        if self.source_mode == "LLM" and self.has_last_llm:
            return self.last_llm_input
        return self.current_prompt

    def is_current_view(self) -> bool:
        return self.view_mode == "CURRENT"

    def is_history_view(self) -> bool:
        return self.view_mode != "CURRENT"

    def is_editable(self) -> bool:
        if self.view_mode == "CURRENT":
            return self.source_mode == "MANUAL"
        return self.history_unlocked

    def is_replace_allowed(self) -> bool:
        return self.is_editable()

    def is_paste_allowed(self) -> bool:
        return self.is_editable()

    def active_output(self) -> str:
        """Graph output. History viewing/editing must never change this."""
        if self.source_mode == "LLM" and self.has_last_llm:
            return self.last_llm_input
        return self.current_prompt

    def on_connect(self) -> None:
        self.connected = True
        self.source_mode = "LLM"
        self.history_unlocked = False

    def on_disconnect(self) -> None:
        """Keep current prompt (last active, often last LLM). Do not overwrite last_manual."""
        self.connected = False
        self.source_mode = "MANUAL"
        self.history_unlocked = False

    def toggle_source_mode(self) -> bool:
        """Switch MANUAL/LLM while keeping the cable. No-op if unconnected."""
        if not self.connected:
            return False
        self.source_mode = "MANUAL" if self.source_mode == "LLM" else "LLM"
        self.history_unlocked = False
        return True

    def paste_replace(self, text: str) -> bool:
        if not self.is_paste_allowed():
            return False
        if not isinstance(text, str):
            text = str(text)
        self.on_manual_edit(text)
        return True

    def paste_append(self, text: str) -> bool:
        if not self.is_paste_allowed():
            return False
        if not isinstance(text, str):
            text = str(text)
        self.on_manual_edit(self.displayed_text() + text)
        return True

    def use_as_current(self) -> bool:
        """Promote the visible history buffer to the live MANUAL prompt."""
        if not self.is_history_view():
            return False
        text = self.displayed_text()
        self.source_mode = "MANUAL"
        self.view_mode = "CURRENT"
        self.history_unlocked = False
        self.current_prompt = text
        self.last_manual_input = text
        self.has_last_manual = True
        return True

    def can_open_last_manual(self) -> bool:
        return self.has_last_manual

    def can_open_last_llm(self) -> bool:
        return self.has_last_llm

    def footer_context(self) -> str:
        if self.view_mode == "LAST_MANUAL":
            viewing = "Viewing last manual"
        elif self.view_mode == "LAST_LLM":
            viewing = "Viewing last LLM"
        elif self.source_mode == "LLM":
            viewing = "Viewing current LLM"
        else:
            viewing = "Editing current"
        output = "Output is LLM" if self.source_mode == "LLM" else "Output is MANUAL"
        return f"{viewing} · {output}"

    def on_llm_resolved(self, text: str) -> None:
        if text is None:
            return
        if not isinstance(text, str):
            text = str(text)
        self.last_llm_input = text
        self.has_last_llm = True
        if self.source_mode == "LLM":
            self.current_prompt = text

    def on_manual_edit(self, text: str) -> None:
        if not self.is_editable():
            return
        if not isinstance(text, str):
            text = str(text)
        if self.view_mode == "CURRENT":
            self.current_prompt = text
            self.last_manual_input = text
            self.has_last_manual = True
        elif self.view_mode == "LAST_MANUAL":
            self.last_manual_input = text
            self.has_last_manual = True
        elif self.view_mode == "LAST_LLM":
            self.last_llm_input = text
            self.has_last_llm = True

    def toggle_last_manual(self) -> None:
        if self.view_mode == "LAST_MANUAL":
            self.exit_history()
            return
        self.view_mode = "LAST_MANUAL"
        self.history_unlocked = False

    def toggle_last_llm(self) -> None:
        if self.view_mode == "LAST_LLM":
            self.exit_history()
            return
        self.view_mode = "LAST_LLM"
        self.history_unlocked = False

    def exit_history(self) -> None:
        self.view_mode = "CURRENT"
        self.history_unlocked = False

    def unlock_history_edit(self) -> None:
        if self.is_history_view():
            self.history_unlocked = True

    def apply_replace_all(self, find: str, replacement: str, *, case_sensitive: bool, whole_word: bool) -> int:
        if not self.is_replace_allowed() or find == "":
            return 0
        text = self.displayed_text()
        new_text, count = replace_all(text, find, replacement, case_sensitive=case_sensitive, whole_word=whole_word)
        if count:
            self.on_manual_edit(new_text)
        return count


def _is_word_char(ch: str) -> bool:
    return ch.isalnum() or ch == "_"


def find_matches(text: str, query: str, *, case_sensitive: bool, whole_word: bool) -> list[tuple[int, int]]:
    if not query or text is None:
        return []
    hay = text if case_sensitive else text.lower()
    needle = query if case_sensitive else query.lower()
    matches: list[tuple[int, int]] = []
    start = 0
    nlen = len(needle)
    while True:
        idx = hay.find(needle, start)
        if idx < 0:
            break
        end = idx + nlen
        if whole_word:
            left_ok = idx == 0 or not _is_word_char(text[idx - 1])
            right_ok = end >= len(text) or not _is_word_char(text[end])
            if not (left_ok and right_ok):
                start = idx + 1
                continue
        matches.append((idx, end))
        start = idx + max(nlen, 1)
    return matches


def replace_all(
    text: str,
    query: str,
    replacement: str,
    *,
    case_sensitive: bool,
    whole_word: bool,
) -> tuple[str, int]:
    matches = find_matches(text, query, case_sensitive=case_sensitive, whole_word=whole_word)
    if not matches:
        return text, 0
    parts: list[str] = []
    last = 0
    for start, end in matches:
        parts.append(text[last:start])
        parts.append(replacement)
        last = end
    parts.append(text[last:])
    return "".join(parts), len(matches)
