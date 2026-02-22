import os
import glob
import re

tools_dir = "python/tools"

for filepath in glob.glob(f"{tools_dir}/*.py"):
    with open(filepath, 'r') as f:
        content = f.read()

    # PY3: Fix rate limit (Instead of patching 73 files, we'll patch ai_models to provide a get_client or just wrap models.generate_content)
    # Actually, let's fix PY5 first.
    
    # PY5: json.loads without try block.
    # We will look for: result = json.loads(response.text) or something similar
    # Regex approach for PY5:
    content = re.sub(
        r'(\s+)([\w_]+) = json\.loads\(([\w_]+\.text)\)',
        r'\1try:\1    \2 = json.loads(\3)\1except json.JSONDecodeError:\1    \2 = {"raw_text": \3, "error": "Failed to parse JSON"}',
        content
    )
    
    # PY11: Path traversal protection. 
    # If a tool reads from file_path, let's just make it use safe_path

    with open(filepath, 'w') as f:
        f.write(content)

print("Applied PY5 fixes to tools.")
