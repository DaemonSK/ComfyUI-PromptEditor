# Repository Engineering Rules

- Use the `comfyui-custom-node-development` skill for ComfyUI-specific work.
- Keep machine-specific installation paths in ignored `AGENTS-LOCAL.md`, never in this file.
- Use `tests/run_tests.py` for Python and focused frontend test selection.
- Run the selector from the configured ComfyUI root with that installation's Python executable.
- During iteration, run one exact test or one explicit group.
- Before handoff, run `--changed` once. Use `--final` only as a deliberate broader gate.
- Stage a new production source before relying on `--changed`, or select its group explicitly.
- Do not run model inference for this node's tests.
