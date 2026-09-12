# Publishing to ComfyUI Manager / Registry

The Registry powers ComfyUI-Manager. This node publishes as:

- Publisher id: `bonfire` (display name Bonfire)
- Node id: `prompt-editor` (immutable after first publish)
- GitHub: https://github.com/DaemonSK/ComfyUI-PromptEditor

## Secrets (not in git)

Store the Registry API key in:

`.secrets/comfy-registry.env`

Use `.env.example` as the template. `.secrets/` is gitignored.

GitHub Actions uses repository secret `REGISTRY_ACCESS_TOKEN` (same key). Do not put the key in workflow YAML.

## Publish a version

Bump `version` in `pyproject.toml`, then either:

```bash
comfy node publish --token "<key from .secrets>"
```

or push a `pyproject.toml` change to `master` so the publish workflow runs.

Node id and publisher id cannot be changed after the first successful publish.
