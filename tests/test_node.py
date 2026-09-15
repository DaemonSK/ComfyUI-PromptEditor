"""Backend node tests. Requires ComfyUI on PYTHONPATH."""

from __future__ import annotations

import sys
import unittest
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from prompt_editor import NODE_ID, PromptEditor, comfy_entrypoint


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
        self.assertIn("source_mode", input_ids)
        self.assertIn("has_last_manual", input_ids)
        self.assertIn("has_last_llm", input_ids)
        self.assertEqual(schema.outputs[0].get_io_type(), "STRING")
        self.assertEqual(len(schema.outputs), 1)

    def test_text_input_is_optional_force_input(self):
        schema = PromptEditor.GET_SCHEMA()
        text = next(i for i in schema.inputs if i.id == "text")
        self.assertTrue(text.optional)
        self.assertTrue(text.force_input)
        self.assertTrue(text.lazy)

    def test_lazy_status_requests_text_only_in_llm_mode(self):
        self.assertEqual(
            PromptEditor.check_lazy_status(source_mode="MANUAL", text=None),
            [],
        )
        self.assertEqual(
            PromptEditor.check_lazy_status(source_mode="LLM", text=None),
            ["text"],
        )
        self.assertEqual(
            PromptEditor.check_lazy_status(source_mode="LLM", text="ready"),
            [],
        )


class ExecuteTests(unittest.TestCase):
    def test_manual_passthrough_exact(self):
        raw = "  Hello\nWORLD  {lora:foo}  "
        result = PromptEditor.execute(current_prompt=raw, text=None)
        self.assertEqual(result.args[0], raw)
        self.assertEqual(result.ui["text"], (raw,))
        self.assertEqual(result.ui["source_mode"], ("MANUAL",))

    def test_connected_string_wins_in_llm_mode(self):
        result = PromptEditor.execute(current_prompt="manual", text="llm value", source_mode="LLM")
        self.assertEqual(result.args[0], "llm value")
        self.assertEqual(result.ui["text"], ("llm value",))
        self.assertEqual(result.ui["source_mode"], ("LLM",))

    def test_manual_mode_ignores_connected_string(self):
        result = PromptEditor.execute(current_prompt="local", text="llm value", source_mode="MANUAL")
        self.assertEqual(result.args[0], "local")

    def test_empty_connected_string_is_llm(self):
        result = PromptEditor.execute(current_prompt="manual", text="", source_mode="LLM")
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

    def test_package_entrypoint_loads_with_relative_imports(self):
        root = Path(__file__).resolve().parents[1]
        spec = spec_from_file_location(
            "prompt_editor_package_test",
            root / "__init__.py",
            submodule_search_locations=[str(root)],
        )
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = module_from_spec(spec)
        sys.modules[spec.name] = module
        try:
            spec.loader.exec_module(module)
            self.assertEqual(module.NODE_ID, NODE_ID)
            self.assertEqual(module.WEB_DIRECTORY, "./web")
        finally:
            sys.modules.pop(spec.name, None)


if __name__ == "__main__":
    unittest.main()
