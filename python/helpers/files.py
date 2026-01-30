
import os

def get_abs_path(path):
    return os.path.abspath(path)

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
