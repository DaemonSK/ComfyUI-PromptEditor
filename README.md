# Prompt Editor

A ComfyUI custom node for writing and inspecting prompts.

**Version:** 0.1.0 beta  
**Displayed name:** Prompt Editor  
**Category:** `utils/text`  
**Internal id:** `XAI_PromptEditor`

## Purpose

Use this node as a large, real text editor for prompts. It keeps three separate values:

- **current prompt** — the last active graph prompt
- **last manual input** — the last prompt typed by hand
- **last LLM input** — the last resolved connected STRING

The visible editor is not always the active graph output. History viewing never silently changes output.

## Installation

Copy or junction this folder into your ComfyUI `custom_nodes` directory as `ComfyUI-PromptEditor`, then **restart ComfyUI**.

This workspace is already junctioned to:

`H:\Comfy\August - auto installer\Comfyui auto installer\custom_nodes\ComfyUI-PromptEditor`

Restart the running ComfyUI process to load the node. Search **Prompt Editor** under `utils/text`.

Example (Windows, from an elevated or Developer PowerShell):

```powershell
New-Item -ItemType Junction -Path "H:\path\to\ComfyUI\custom_nodes\ComfyUI-PromptEditor" -Target "D:\path\to\ComfyUI-PromptEditor"
```

No extra Python or npm packages are required.

## STRING input / output

| | |
|---|---|
| Input | Optional connectable `STRING` named `text`. Any upstream text node counts, including a local LLM. |
| Output | Standard ComfyUI `STRING` named `prompt`. Connect it to CLIP encode, samplers, or any STRING consumer. |

In **MANUAL** mode the output is the current prompt.  
In **LLM** mode the output is the resolved upstream STRING after execution.

A connected cable does **not** force LLM mode. Click the MANUAL/LLM control to switch while keeping the cable.

## MANUAL vs LLM

The control is on the **far left** of the toolbar.

| | |
|---|---|
| `MANUAL` (no light) | No STRING connected. Editing is local. |
| `MANUAL` (hollow green dot) | Cable still connected, but output is your local text. Click to use LLM. |
| `LLM` (filled green light) | Using the connected STRING. CURRENT is read-only. Click to edit locally without disconnecting. |

`LLM` means “use the upstream text node.” It does **not** mean a cloud model.

- Connect a cable → switches to LLM.
- Disconnect → switches to MANUAL and keeps the last current text.
- While connected, click the control to toggle. The cable stays.
- Viewing Last Manual / Last LLM never changes this control.

## Toolbar

Left to right:

`[ MANUAL/LLM ]`  Find  Find & Replace  Copy  Paste  Last Manual Input  Last LLM Input

## Last Manual Input

Click once to view the stored last manual prompt. The editor is read-only at first. Status and graph output do not change. Click again to return to CURRENT.

## Last LLM Input

Same behavior as Last Manual Input, for the stored last connected STRING.

Only one history view can be active. The active history button gets a subtle highlight.

## Double-click history editing

While viewing either history buffer, **double-click** the editor to unlock that stored copy for editing.

- Editing Last Manual updates only `lastManualInput`
- Editing Last LLM updates only `lastLLMInput`
- The connected cable, current prompt, and graph output do **not** change

Leaving history (click the same button again) locks it again.

## Find

Button **Find**, or **Ctrl+F**.

- Search the currently displayed text (CURRENT, Last Manual, or Last LLM)
- Next / Previous, match counter (`3 / 12`)
- Enter = next, Shift+Enter = previous, Esc closes
- Click Find again (or Esc) to close the find bar
- Typing in Find or the editor only updates the match count; it does not steal the caret. Use Next/Prev or Enter to jump to a match
- Optional Case Sensitive and Whole Word
- Search never modifies text
- Opening Find / Find & Replace does not lock the editor. Read-only still applies only to Last Manual / Last LLM until you double-click to unlock history editing.

## Find & Replace

Button **Find & Replace**, or **Ctrl+H**.

Replace / Replace All are available only when the displayed text is editable:

- CURRENT + MANUAL
- Unlocked history

They are unavailable in CURRENT connected-LLM view (the upstream STRING is authoritative) and in locked history. Find still works.

## Copy

Copies **exactly** the text currently shown in the editor, including line breaks — even if that is a history view and the graph output is different. The button briefly shows `✓ Copied`.

## Paste

Replaces the **entire displayed** buffer with the clipboard, exact text. Same editability rules as typing (CURRENT MANUAL, or unlocked history). Disabled in CURRENT LLM mode and locked history.

Shortcut: **Ctrl+Shift+V**. Plain Ctrl+V still inserts at the caret. The button briefly shows `✓ Pasted`.

## Spellcheck

The editor uses native browser spellcheck (`spellcheck="true"`, `lang="en"`). Misspelled English words get the browser underline and right-click suggestions. Nothing is auto-corrected. Prompt syntax, LoRA names, and invented words are left alone.

## Workflow persistence

Saved with the workflow:

- current prompt
- last manual input
- last LLM input
- source mode (`MANUAL` / `LLM`)

Not saved (reset on reload): search query, Copied indicator, history-unlocked state.

## Disconnecting or switching off an LLM

Example: manual `A` → connect LLM → generate `B` then `C` → disconnect **or** click to MANUAL (cable stays).

- Status becomes `MANUAL`
- Editor keeps `C` (last active prompt) and becomes editable
- Last Manual stays `A` until you actually edit
- After you edit `C` into `D`: current = `D`, last manual = `D`, last LLM = `C`
- If the cable is still connected, click the control again to return to LLM (`C` as the active graph value; `D` remains in Last Manual)

## LLM result refresh

A graph link does not expose the upstream runtime STRING to this editor before execution. After this node runs, the backend returns the resolved STRING and a `PreviewText` UI payload. The frontend `onExecuted` handler updates the visible CURRENT text.

Arbitrary token-by-token streaming from upstream LLM nodes is **not** guaranteed. The editor refreshes when the connected STRING is resolved through normal ComfyUI execution.

## Dependencies

None beyond ComfyUI, the Python standard library, and browser APIs.

## Compatibility

Built against current ComfyUI V3 (`comfy_api.latest` / `ComfyExtension`) with a fallback import of `comfy_api.v0_0_2`. See `docs/COMPATIBILITY.md`.

## Limitations

- No in-node AI generation, presets, databases, or prompt rewriting
- No regex search in v0.1
- Native spellcheck quality depends on the browser
- Streaming tokens from arbitrary LLM nodes is not a generic ComfyUI feature; refresh happens on execution
