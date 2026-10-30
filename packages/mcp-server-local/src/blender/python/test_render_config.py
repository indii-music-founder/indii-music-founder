"""Pure config contract extracted from the real runner; no simulated bpy module."""
import ast
import pathlib
import unittest

source = pathlib.Path(__file__).with_name('runner.py').read_text()
tree = ast.parse(source)
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'validate_render_config')
namespace = {}
exec(compile(ast.Module(body=[function], type_ignores=[]), 'runner-config-contract', 'exec'), namespace)
validate = namespace['validate_render_config']

class RenderConfigContract(unittest.TestCase):
    def test_known_templates(self):
        for template in ('audio_reactive_tunnel', 'vinyl_turntable', 'chrome_text', 'spectrum_bars', 'concert_stage'):
            validate({'templateId': template})

    def test_executable_configuration_rejected(self):
        for value in ('/not-read.py', '', None):
            with self.assertRaises(ValueError):
                validate({'templateId': 'chrome_text', 'customScriptPath': value})

    def test_unknown_and_nonobject_config_rejected(self):
        for config in ({}, {'templateId': '../custom'}, [], None):
            with self.assertRaises(ValueError):
                validate(config)

    def test_validation_precedes_scene_mutation(self):
        main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'main')
        calls = [node for node in ast.walk(main) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)]
        validation = next(node.lineno for node in calls if node.func.id == 'validate_render_config')
        mutation = next(node.lineno for node in calls if node.func.id == 'clear_default_scene')
        self.assertLess(validation, mutation)
        self.assertNotIn('exec', [node.func.id for node in calls])

if __name__ == '__main__':
    unittest.main()
