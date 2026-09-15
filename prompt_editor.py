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
                "Write and inspect prompts. Connect an upstream STRING, then use "
                "the MANUAL/LLM control to choose local text or the connected "
                "value without disconnecting. History buttons never change the "
                "active output."
            ),
            search_aliases=["prompt editor", "text editor", "llm prompt", "prompt text"],
            is_output_node=True,
            inputs=[
                io.String.Input(
                    "text",
                    optional=True,
                    force_input=True,
                    lazy=True,
                    tooltip="Connect any upstream STRING (local or remote LLM, or any text node).",
                ),
                io.String.Input(
                    "source_mode",
                    default="MANUAL",
                    multiline=False,
                    socketless=True,
                    dynamic_prompts=False,
                    extra_dict=_HIDDEN_WIDGET,
                    tooltip="Active mode: MANUAL (local text) or LLM (connected STRING).",
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
                io.Boolean.Input(
                    "has_last_manual",
                    default=False,
                    socketless=True,
                    extra_dict=_HIDDEN_WIDGET,
                    tooltip="Whether an empty or non-empty manual history value has been stored.",
                ),
                io.Boolean.Input(
                    "has_last_llm",
                    default=False,
                    socketless=True,
                    extra_dict=_HIDDEN_WIDGET,
                    tooltip="Whether an empty or non-empty connected STRING has been stored.",
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
        source_mode: str = "MANUAL",
        text: str | None = None,
        **kwargs: Any,
    ):
        mode = _normalize_mode(source_mode)
        if mode == "LLM" and text is not None:
            return ("llm", text)
        return ("manual", current_prompt if current_prompt is not None else "")

    @classmethod
    def check_lazy_status(
        cls,
        current_prompt: str = "",  # noqa: ARG003
        last_manual_input: str = "",  # noqa: ARG003
        last_llm_input: str = "",  # noqa: ARG003
        source_mode: str = "MANUAL",
        text: str | None = None,
        **kwargs: Any,
    ):
        if _normalize_mode(source_mode) == "LLM" and text is None:
            return ["text"]
        return []

    @classmethod
    def execute(
        cls,
        current_prompt: str = "",
        last_manual_input: str = "",  # noqa: ARG003 - persisted by frontend
        last_llm_input: str = "",  # noqa: ARG003 - persisted by frontend
        source_mode: str = "MANUAL",
        text: str | None = None,
        **kwargs: Any,
    ) -> io.NodeOutput:
        if current_prompt is None:
            current_prompt = ""
        if not isinstance(current_prompt, str):
            current_prompt = str(current_prompt)

        mode = _normalize_mode(source_mode)
        if mode == "MANUAL":
            output = current_prompt
        elif text is None:
            output = current_prompt
        else:
            if not isinstance(text, str):
                text = str(text)
            output = text

        ui_payload = ui.PreviewText(output).as_dict()
        ui_payload["source_mode"] = (mode,)
        return io.NodeOutput(output, ui=ui_payload)


def _normalize_mode(source_mode: str | None) -> str:
    if isinstance(source_mode, str) and source_mode.strip().upper() == "LLM":
        return "LLM"
    return "MANUAL"


class PromptEditorExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [PromptEditor]


async def comfy_entrypoint() -> PromptEditorExtension:
    return PromptEditorExtension()
