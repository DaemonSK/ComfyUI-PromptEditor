---
schema: comfyui-compat/1

supported:
  comfyui_min: "0.34.0"
  comfyui_max: ""
  comfy_api: "latest"
  node_schema: "V3"
  python: [">=3.10", "<3.15"]
  pytorch: "any (node does not use torch)"

verified:
  date: "2026-09-15"
  comfyui_version: "0.35.1-dirty"
  comfyui_commit: "856a922befab9d94cb66f36a3dce17234d7a6e31"
  frontend_version: "1.51.10"
  frontend_pinned_by_backend: "1.51.10"
  python: "3.12.13"
  pytorch: "2.13.0+cu130 (unused by this node)"
  platform: "windows"
  method: "pytest+node+live-browser"
  evidence: "Repository selector: 11 backend tests passed against installed ComfyUI, 8 frontend state tests passed, and the live Playwright paste test passed with the workspace frontend intercepted into ComfyUI. node --check passed for web/pe_ui.js and web/prompt_editor_state.mjs. No model inference."

review:
  last_review_date: "2026-09-15"
  reviewed_upstream_to:
    comfyui: "36da3ff763687eab86a35e1019995dd1fb369b0d"
    frontend: "06727dd447a559f00ded4560828790beb2928a56"
  next_review_due: ""

upstream_surface:
  comfyui_paths:
    - "nodes.py"
    - "comfy_api/latest/__init__.py"
    - "comfy_api/latest/_io.py"
    - "comfy_api/latest/_ui.py"
    - "comfy_api/v0_0_2/__init__.py"
    - "server.py"
  frontend_paths:
    - "src/scripts/app.ts"
    - "src/scripts/domWidget.ts"
    - "src/scripts/api.ts"
    - "src/types/litegraph-augmentation.d.ts"
    - "src/extensions/core/previewAny.ts"
    - "src/extensions/core/textPreviewWidgets.ts"
    - "src/renderer/extensions/vueNodes/widgets/composables/useStringWidget.ts"
  http_endpoints: []
  ws_messages:
    - "executed"

deprecations:
  - api: "LGraphNode.prototype hijacking"
    where: "web/pe_ui.js (instance methods only: onExecuted, onConnectionsChange, onRemoved)"
    status: "ok"
    replacement: "No official extension hook exists for connection changes or onExecuted; instance wrapping is scoped to this node."
    action: "keep"
---

# ComfyUI Compatibility

> **Rule:** nothing in `verified:` may be changed without having actually run something.
> A successful import is not verification. If it was not tested, the field stays empty
> and the claim is marked unverified.

## Supported (claim)

| | |
|---|---|
| Minimum ComfyUI | `0.34.0` |
| Maximum ComfyUI | *no declared upper bound* |
| `comfy_api` surface | `latest` (import fallback `v0_0_2`) |
| Node schema | V3 |
| Python | ≥3.10, <3.15 |
| PyTorch | *not used by this node* |

`comfy_api.latest` is `STABLE = False` as of the 2026-09-07 review. Official docs and `example_node.py.example` still use it for new V3 nodes. `v0_0_2` re-exports the same surface.

## Verified (evidence)

| | |
|---|---|
| Date | 2026-09-15 |
| ComfyUI version / commit | 0.35.1-dirty / `856a922b` |
| Frontend version exercised | 1.51.10 (live Playwright test) |
| Frontend pinned by that backend | 1.51.10 |
| Python / PyTorch | 3.12.13 / 2.13.0+cu130 (unused) |
| Platform | Windows |
| Method | `pytest` + Node tests + live Playwright browser test |
| Evidence | 11 backend tests, 8 frontend state tests, and 1 live browser test passed; JS syntax checks passed. Workspace frontend was intercepted into the running local ComfyUI. No model inference. |

> **Latest upstream ≠ latest stable ≠ what this project targets ≠ what is installed.**
> Record all four separately; never infer one from another.

Four versions at build time (2026-09-07):

| | |
|---|---|
| Latest upstream backend (`master`) | v0.34.0 `eb357862` |
| Latest stable backend tag | v0.34.0 |
| Frontend repo HEAD | v1.54.6 `8ee65b85e6` |
| Frontend pinned by upstream backend | 1.51.10 |
| Installed ComfyUI | v0.34.5 `7fd919f0` |
| Installed frontend package | 1.49.6 |
| Installed backend frontend pin | 1.49.6 |

## Upstream surface this project depends on

| Kind | Item | Why we depend on it |
|---|---|---|
| path | `nodes.py` | `comfy_entrypoint` + `WEB_DIRECTORY` loader |
| path | `comfy_api/latest/_io.py` | V3 schema, `String.Input`/`Output`, `force_input`, `socketless` |
| path | `comfy_api/latest/_ui.py` | `PreviewText` UI payload |
| path | `server.py` | `/extensions` glob of `WEB_DIRECTORY/**/*.js` |
| frontend | `src/scripts/app.ts` | `executed` → `node.onExecuted` |
| frontend | `src/scripts/domWidget.ts` | `addDOMWidget`, `afterResize` |
| ws | `executed` | Resolved STRING refresh |

## Known deprecated API usage

| API / pattern | Where (file:line) | Status | Replacement | Action |
|---|---|---|---|---|
| Instance wrap of `onConnectionsChange` / `onExecuted` | `web/pe_ui.js` | ok | No official hook for these events | keep, scoped to this node |
| `beforeResize` also set | `web/pe_ui.js` | deprecated | `afterResize` | both set for supported frontend compatibility |
| `import { app } from "../../scripts/app.js"` | `web/pe_ui.js` | ok | Documented extension import | keep |

## Review log

| Date | Reviewed upstream to (ComfyUI / frontend) | Outcome | Notes |
|---|---|---|---|
| 2026-09-07 | `eb357862` / `8ee65b85e6` | compatible | Unit + CI startup against installed 0.34.5 / frontend 1.49.6. GUI not exercised. |
| 2026-09-15 | `36da3ff7` / `06727dd4` | compatible | Required V3 schema, UI payload, loader, extension, DOM-widget, and resize surfaces remain present. Backend, Node, syntax, and live paste checks passed against the installed environment. |
