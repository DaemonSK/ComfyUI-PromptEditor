"""Prompt Editor — ComfyUI V3 custom node.

Backend is intentionally small: register the node, accept an optional connected
STRING, persist the active prompt, and return a standard STRING plus a
PreviewText UI payload so the frontend can refresh after execution.
"""

from __future__ import annotations

from typing import Any

try:
    from comfy_api.latest import ComfyExtension, io, ui
except ImportError:  # pragma: no cover - older numbered surface
    from comfy_api.v0_0_2 import ComfyExtension, io, ui  # type: ignore


NODE_ID = "XAI_PromptEditor"
DISPLAY_NAME = "Prompt Editor"
CATEGORY = "utils/text"

_HIDDEN_WIDGET = {"hidden": True}


class PromptEditor(io.ComfyNode):
    """Advanced prompt text editor with MANUAL/LLM status and history buffers."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id=NODE_ID,
            display_name=DISPLAY_NAME,
            category=CATEGORY,
            description=(
                "Write and inspect prompts. Connect an upstream STRING to use it "
                "as the active graph value (LLM status). History buttons never "
                "change the active output."
            ),
            search_aliases=["prompt editor", "text editor", "llm prompt", "prompt text"],
            is_output_node=True,
            inputs=[
                io.String.Input(
                    "text",
                    optional=True,
                    force_input=True,
                    tooltip="Connect any upstream STRING (local or remote LLM, or any text node).",
                ),
                io.String.Input(
                    "current_prompt",
                    default="",
                    multiline=False,
                    socketless=True,
                    dynamic_prompts=False,
                    extra_dict=_HIDDEN_WIDGET,
                    tooltip="Active prompt used when no STRING is connected.",
                ),
                io.String.Input(
                    "last_manual_input",
                    default="",
                    multiline=False,
                    socketless=True,
                    dynamic_prompts=False,
                    extra_dict=_HIDDEN_WIDGET,
                    tooltip="Stored last manual prompt (history buffer).",
                ),
                io.String.Input(
                    "last_llm_input",
                    default="",
                    multiline=False,
                    socketless=True,
                    dynamic_prompts=False,
                    extra_dict=_HIDDEN_WIDGET,
                    tooltip="Stored last connected STRING (history buffer).",
                ),
            ],
            outputs=[
                io.String.Output(
                    id="prompt",
                    display_name="prompt",
                    tooltip="Active prompt. Viewing or editing history does not change this.",
                ),
            ],
        )

    @classmethod
    def fingerprint_inputs(
        cls,
        current_prompt: str = "",
        last_manual_input: str = "",  # noqa: ARG003
        last_llm_input: str = "",  # noqa: ARG003
        text: str | None = None,
        **kwargs: Any,
    ):
        if text is not None:
            return ("llm", text)
        return ("manual", current_prompt if current_prompt is not None else "")

    @classmethod
    def execute(
        cls,
        current_prompt: str = "",
        last_manual_input: str = "",  # noqa: ARG003 - persisted by frontend
        last_llm_input: str = "",  # noqa: ARG003 - persisted by frontend
        text: str | None = None,
        **kwargs: Any,
    ) -> io.NodeOutput:
        if current_prompt is None:
            current_prompt = ""
        if not isinstance(current_prompt, str):
            current_prompt = str(current_prompt)

        if text is None:
            output = current_prompt
        else:
            if not isinstance(text, str):
                text = str(text)
            output = text

        return io.NodeOutput(output, ui=ui.PreviewText(output))


class PromptEditorExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [PromptEditor]


async def comfy_entrypoint() -> PromptEditorExtension:
    return PromptEditorExtension()
