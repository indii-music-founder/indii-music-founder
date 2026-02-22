import os
import glob
import re

tools_dir = "python/tools"

py3_imports = """
from python.helpers.rate_limiter import RateLimiter
import asyncio
"""
py3_wait = """
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
"""

py11_import = """
from python.helpers.files import safe_path
"""

for filepath in glob.glob(f"{tools_dir}/*.py"):
    with open(filepath, 'r') as f:
        content = f.read()
        
    changed = False

    # PY3: Inject RateLimiter before generate_content
    if re.search(r'response = client\.models\.generate_(content|images|videos)\(', content):
        if 'RateLimiter' not in content:
            # Add imports
            content = py3_imports + content
        
        # Inject the wait logic before the call
        new_content = re.sub(
            r'(\s+)(response = client\.models\.generate_(content|images|videos)\()',
            r'\1' + py3_wait.replace('\n', '\n' + r'\1') + r'\response = client.models.generate_\3(',
            content
        )
        if new_content != content:
            changed = True
            content = new_content

    # PY11: Replace direct python file reads or uploads with safe_path
    if re.search(r'client\.files\.upload\(file=(?!safe_path\()([\w_]+)\)', content):
        if 'safe_path' not in content:
            content = py11_import + content
        content = re.sub(
            r'client\.files\.upload\(file=(?!safe_path\()([\w_]+)\)',
            r'client.files.upload(file=safe_path(\1))',
            content
        )
        changed = True

    if changed:
        with open(filepath, 'w') as f:
            f.write(content)

print("Applied PY3 and PY11 fixes to tools.")
