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
  date: "2026-09-07"
  comfyui_version: "0.34.5"
  comfyui_commit: "7fd919f0"
  frontend_version: "1.49.6"
  frontend_pinned_by_backend: "1.49.6"
  python: "3.12.13"
  pytorch: "2.13.0+cu130 (unused by this node)"
  platform: "windows"
  method: "unit+integration"
  evidence: "unittest tests.test_state_machine (15 ok) and tests.test_node (8 ok) against installed ComfyUI; node --check web/prompt_editor.js; main.py --quick-test-for-ci --cpu --disable-all-custom-nodes --whitelist-custom-nodes ComfyUI-PromptEditor --database-url sqlite:///:memory: exit 0, imported in 0.0s, WEB_DIRECTORY registered. GUI not exercised (live ComfyUI already running; restart required to appear in the UI)."

review:
  last_review_date: "2026-09-07"
  reviewed_upstream_to:
    comfyui: "eb357862592aefe8e136031b9e3aa14e55abddaa"
    frontend: "8ee65b85e667579c0176686139b36efbfe02e62d"
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
    where: "web/prompt_editor.js (instance methods only: onExecuted, onConnectionsChange, onRemoved)"
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
| Date | 2026-09-07 |
| ComfyUI version / commit | 0.34.5 / `7fd919f0` |
| Frontend version exercised | 1.49.6 (package present; GUI not clicked) |
| Frontend pinned by that backend | 1.49.6 |
| Python / PyTorch | 3.12.13 / 2.13.0+cu130 (unused) |
| Platform | Windows |
| Method | `unit` + `integration` (`--quick-test-for-ci`) |
| Evidence | 23 unittest cases OK; JS `node --check` OK; ComfyUI CI startup exit 0, node imported in 0.0s, web folder registered. No GUI click-through. |

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
| Instance wrap of `onConnectionsChange` / `onExecuted` | `web/prompt_editor.js` | ok | No official hook for these events | keep, scoped to this node |
| `beforeResize` also set | `web/prompt_editor.js` | deprecated | `afterResize` | both set for 1.49.6 compat |
| `import { app } from "../../scripts/app.js"` | `web/prompt_editor.js` | ok | Documented extension import | keep |

## Review log

| Date | Reviewed upstream to (ComfyUI / frontend) | Outcome | Notes |
|---|---|---|---|
| 2026-09-07 | `eb357862` / `8ee65b85e6` | compatible | Unit + CI startup against installed 0.34.5 / frontend 1.49.6. GUI not exercised. |
