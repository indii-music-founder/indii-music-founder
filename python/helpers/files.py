
import os

def get_abs_path(path):
    abs_path = os.path.abspath(path)
    assets_dir = os.path.abspath(os.path.join(os.getcwd(), "assets"))
    if not abs_path.startswith(assets_dir):
        raise ValueError(f"Security Error: Path traversal outside assets/ detected: {path}")
    return abs_path

def read_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return ""

def replace_placeholders_text(_content, **kwargs):
    for key, value in kwargs.items():
        _content = _content.replace(f"{{{{{key}}}}}", str(value))
    return _content

def make_dirs(path):
    os.makedirs(path, exist_ok=True)

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def safe_path(path):
    import os
    abs_path = os.path.abspath(path)
    assets_dir = os.path.abspath(os.path.join(os.getcwd(), "assets"))
    if not abs_path.startswith(assets_dir):
        raise ValueError(f"Security Error: Path traversal outside assets/ detected: {path}")
    return abs_path
