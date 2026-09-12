# Prompt Editor

Write and inspect prompts in a real multiline editor.

- **Input:** optional connected `STRING` (`text`)
- **Output:** standard `STRING` (`prompt`)
- **Status:** clickable `MANUAL` / `LLM`. Cable can stay connected; click to edit locally or use the upstream STRING. Green light = LLM. Hollow dot = cable present but MANUAL.
- **History:** Last Manual Input / Last LLM Input view stored copies without changing graph output. Double-click to unlock editing of a history copy.
- **Find / Replace:** Ctrl+F and Ctrl+H. Replace is blocked while CURRENT is LLM. Esc closes Find, then leaves history.
- **Use as current:** while viewing history, promote that text to the live MANUAL prompt.
- **Paste:** replace from clipboard; Shift+click appends; drop a `.txt` file.

The text is never auto-trimmed, rewritten, or spell-corrected.
