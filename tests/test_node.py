"""Backend node tests. Requires ComfyUI on PYTHONPATH."""

from __future__ import annotations

import os
import sys
import unittest

_COMFY_CANDIDATES = [
    os.environ.get("COMFYUI_PATH", ""),
    r"H:\Comfy\August - auto installer\Comfyui auto installer\ComfyUI",
    r"C:\Dev\_references\ComfyUI\ComfyUI",
]
for path in _COMFY_CANDIDATES:
    if path and os.path.isdir(path) and path not in sys.path:
        sys.path.insert(0, path)

from prompt_editor import NODE_ID, PromptEditor, comfy_entrypoint  # noqa: E402


class SchemaTests(unittest.TestCase):
    def test_schema_ids_and_io(self):
        schema = PromptEditor.GET_SCHEMA()
        self.assertEqual(schema.node_id, NODE_ID)
        self.assertEqual(schema.display_name, "Prompt Editor")
        self.assertEqual(schema.category, "utils/text")
        input_ids = [inp.id for inp in schema.inputs]
        self.assertIn("text", input_ids)
        self.assertIn("current_prompt", input_ids)
        self.assertIn("last_manual_input", input_ids)
        self.assertIn("last_llm_input", input_ids)
        self.assertEqual(schema.outputs[0].get_io_type(), "STRING")
        self.assertEqual(len(schema.outputs), 1)

    def test_text_input_is_optional_force_input(self):
        schema = PromptEditor.GET_SCHEMA()
        text = next(i for i in schema.inputs if i.id == "text")
        self.assertTrue(text.optional)
        self.assertTrue(text.force_input)


class ExecuteTests(unittest.TestCase):
    def test_manual_passthrough_exact(self):
        raw = "  Hello\nWORLD  {lora:foo}  "
        result = PromptEditor.execute(current_prompt=raw, text=None)
        self.assertEqual(result.args[0], raw)
        self.assertEqual(result.ui.as_dict()["text"], (raw,))

    def test_connected_string_wins(self):
        result = PromptEditor.execute(current_prompt="manual", text="llm value")
        self.assertEqual(result.args[0], "llm value")
        self.assertEqual(result.ui.as_dict()["text"], ("llm value",))

    def test_empty_connected_string_is_llm(self):
        result = PromptEditor.execute(current_prompt="manual", text="")
        self.assertEqual(result.args[0], "")

    def test_none_text_uses_current(self):
        result = PromptEditor.execute(current_prompt="keep", text=None)
        self.assertEqual(result.args[0], "keep")

    def test_does_not_trim(self):
        result = PromptEditor.execute(current_prompt="  x  \n", text=None)
        self.assertEqual(result.args[0], "  x  \n")


class EntryPointTests(unittest.TestCase):
    def test_entrypoint_returns_extension(self):
        import asyncio

        ext = asyncio.run(comfy_entrypoint())
        nodes = asyncio.run(ext.get_node_list())
        self.assertEqual(nodes, [PromptEditor])


if __name__ == "__main__":
    unittest.main()
