# ComfyUI research notes (Prompt Editor)

Verified 2026-09-07.

## Sources

| Item | Location | Commit / version |
|---|---|---|
| Official backend clone | `C:\Dev\_references\ComfyUI\ComfyUI` | `eb357862` (tag v0.34.0, 2026-09-07) |
| Official frontend clone | `C:\Dev\_references\ComfyUI\ComfyUI_frontend` | `8ee65b85e6` (tag v1.54.6, 2026-09-07) |
| Official docs clone | `C:\Dev\_references\ComfyUI\docs` | `07029206` |
| Local ComfyUI | `H:\Comfy\August - auto installer\Comfyui auto installer\ComfyUI` | v0.34.5 (`7fd919f0`) |
| Local frontend package | `comfyui-frontend-package` | 1.49.6 |
| Latest backend frontend pin | `ComfyUI/requirements.txt` | `comfyui-frontend-package==1.51.10` |

Online `docs.comfy.org` was not fetched (SSRF block). Docs were read from the official clone.

## API choices

### Backend: V3 `comfy_api.latest` / `ComfyExtension`

Official current path (`docs/custom-nodes/v3_migration.mdx`, `custom_nodes/example_node.py.example`, `nodes.py` loader). `comfy_entrypoint()` is sufficient; `NODE_CLASS_MAPPINGS` is the V1 path.

`comfy_api.latest` has `STABLE = False`. `v0_0_2` also `STABLE = False` and re-exports latest. Import tries `latest` then `v0_0_2`.

### STRING IO

`io.String.Input(..., optional=True, force_input=True)` for the connectable socket without a default widget. Socketless hidden STRING widgets persist `current_prompt` / history. `io.String.Output` is a normal STRING.

### Execution → frontend

Official UI helper `ui.PreviewText(value)` → `{"text": (value,)}`. Frontend `app.ts` listens for websocket `executed` and calls `node.onExecuted(detail.output)`. PreviewAny uses the same payload with a dedicated preview widget; this node consumes it in its own `onExecuted` and does **not** register `preview_text` widgets, so no duplicate text pane is added.

### Frontend extension

Documented: export `WEB_DIRECTORY`, `app.registerExtension`, hooks `setup`, `nodeCreated`, `loadedGraphNode`, `afterConfigureGraph`.

Custom editor: `node.addDOMWidget` (`src/scripts/domWidget.ts`). Resize: `afterResize` (current) plus `beforeResize` (compat; 1.49.6 still invokes both from `onResize`).

Connection detection: instance `onConnectionsChange` (LiteGraph still fires this; no dedicated extension hook exists). Scoped to this node instance, not a global prototype patch.

Widget hide: `widget.hidden = true` plus `computeSize = () => [0, -4]`, and `extra_dict={"hidden": True}` on the schema.

Serialization: hidden STRING widgets (not the DOM widget). DOM widget `serialize: false`.

### Not used

- Prototype hijacking of `app` or unrelated nodes
- `PromptServer.send_sync` custom message types (PreviewText is the supported UI payload)
- React / Vue / CodeMirror / Monaco / npm
- `dynamic_prompts` (disabled so prompt syntax is not interpreted)

## Installed vs latest

Local backend **0.34.5** is a tagged install slightly ahead of reference `master` **0.34.0**. Local frontend **1.49.6** is behind the backend pin **1.51.10** and frontend repo **1.54.6**. Implementation uses APIs present in 1.49.6 (`addDOMWidget`, `onExecuted`, `onConnectionsChange`, `afterResize`/`beforeResize`).
