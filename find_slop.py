import ast
import os

def check_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, ast.ExceptHandler):
                # check if body is just 'pass'
                if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                    # Check if it's a bare except or Except Exception
                    if node.type is None or (isinstance(node.type, ast.Name) and node.type.id == 'Exception'):
                        print(f"{filepath}:{node.lineno}: found 'except: pass' or 'except Exception: pass'")
    except Exception as e:
        print(f"Error checking file {filepath}: {e}")

for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.venv' in root:
        continue
    for file in files:
        if file.endswith('.py'):
            check_file(os.path.join(root, file))
