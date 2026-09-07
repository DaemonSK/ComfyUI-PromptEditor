# ComfyUI upstream compatibility

This project targets ComfyUI. Compatibility state lives in [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md);
that file is the single source of truth for what this project supports and what was
actually verified.

Before making ComfyUI-specific changes:

1. **Refresh references if stale.** Check `C:\Dev\_references\ComfyUI\.last-sync.json`;
   if it was not refreshed this session, run `update-comfyui-references.ps1`. Do **not**
   update the user's real ComfyUI installation for this.
2. **Read this project's supported range** from `docs/COMPATIBILITY.md` —
   `supported.comfyui_min/max`, `comfy_api`, `node_schema`, `python`, `pytorch`.
3. **Determine current upstream**, separately for each: latest ComfyUI stable tag, latest
   ComfyUI `master`, latest frontend tag, and **the frontend version pinned by that
   backend** (`ComfyUI/requirements.txt` → `comfyui-frontend-package==`). These differ.
4. **Diff only what matters.** From `review.reviewed_upstream_to`, run
   `git log <hash>..HEAD -- <upstream_surface.comfyui_paths>` in the reference clone.
   `comfyui-compat.ps1` does this for you. Reviewing "all upstream changes" is unbounded
   and gets skipped; reviewing the touched surface is finite.
5. **Read current official docs and source** for every API in `upstream_surface`.
   Resolve docs through `https://docs.comfy.org/llms.txt`, not remembered URLs.
6. **Search this repo** for the deprecated/changed APIs surfaced in step 4, and record
   hits in the deprecations table with file:line.
7. **Preserve backwards compatibility** across the declared supported range. Do not
   silently narrow or widen that range — changing it is a deliberate, stated decision.
8. **Do not rewrite working integrations** merely because a newer API exists. Migrate only
   when the old API is deprecated/removed, or migration gives a concrete compatibility,
   correctness, or capability benefit. State the benefit.
9. **Build and run the automated tests.** Report real results, including failures.
10. **Test against a real ComfyUI installation when feasible.** If not feasible, say so
    plainly and set `verified.method: none` — do not imply testing that did not happen.
11. **Update `docs/COMPATIBILITY.md`** — after success *and* after failure. Append a
    review-log row either way; a review that found breakage is worth more than a blank row.

**Never claim compatibility because the code imports successfully.** Imports prove
resolution, not behaviour. `verified:` fields require something to have actually been run;
otherwise they stay empty and the state is `unverified`.

**Treat deprecation warnings as defects** — investigate the cause rather than silencing it.

Full procedure and schema: `~/.claude/comfyui-compatibility.md`
