import unittest
import os
import sys
import json
from python.tools.code_execution_tool import execute_code

class TestCodeExecutionSecurity(unittest.TestCase):
    def test_environment_allowlist(self):
        # Set a sensitive variable that should NOT be passed
        os.environ["SECRET_TOKEN_123"] = "should-not-be-leaked"
        # Set a VITE_ variable that should NOT be passed
        os.environ["VITE_INTERNAL_API"] = "http://internal.secrets"

        code = """
import os
import json
print(json.dumps(dict(os.environ)))
"""
        result = execute_code(code)
        self.assertTrue(result["success"])

        env_output = json.loads(result["stdout"])

        # Check that sensitive keys are missing
        self.assertNotIn("SECRET_TOKEN_123", env_output)
        self.assertNotIn("VITE_INTERNAL_API", env_output)

        # Check that allowed keys are present (if they exist in host)
        if "PATH" in os.environ:
            self.assertIn("PATH", env_output)
        if "HOME" in os.environ:
            self.assertIn("HOME", env_output)

    def test_basic_execution(self):
        code = "print('hello world')"
        result = execute_code(code)
        self.assertTrue(result["success"])
        self.assertEqual(result["stdout"].strip(), "hello world")

if __name__ == "__main__":
    unittest.main()
