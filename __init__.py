if __package__:
    from .prompt_editor import NODE_ID, PromptEditor, comfy_entrypoint
else:  # Direct test collection from a hyphenated custom-node directory.
    from prompt_editor import NODE_ID, PromptEditor, comfy_entrypoint

WEB_DIRECTORY = "./web"

__all__ = [
    "WEB_DIRECTORY",
    "comfy_entrypoint",
    "PromptEditor",
    "NODE_ID",
]
