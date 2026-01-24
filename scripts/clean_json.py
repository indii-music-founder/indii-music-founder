import json
import sys
from collections import OrderedDict

def sort_dict(item):
    if isinstance(item, dict):
        return {k: sort_dict(v) for k, v in sorted(item.items())}
    if isinstance(item, list):
        return [sort_dict(i) for i in item]
    return item

def process_package_json(data):
    # predefined order for top level keys
    top_level_order = [
        "name", "displayName", "version", "description", "author", "license",
        "private", "type", "main", "module", "types", "exports", "bin",
        "files", "directories", "scripts", "dependencies", "devDependencies",
        "peerDependencies", "optionalDependencies", "engines", "os", "cpu",
        "publishConfig", "config"
    ]

    new_data = OrderedDict()

    # Add known keys in order
    for key in top_level_order:
        if key in data:
            if key in ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]:
                new_data[key] = {k: data[key][k] for k in sorted(data[key])}
            elif key == "scripts":
                new_data[key] = {k: data[key][k] for k in sorted(data[key])}
            else:
                new_data[key] = data[key]

    # Add remaining keys sorted
    for key in sorted(data.keys()):
        if key not in new_data:
            new_data[key] = sort_dict(data[key])

    return new_data

def process_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        data = json.loads(content)

        if filepath.endswith("package.json"):
            data = process_package_json(data)
        else:
            data = sort_dict(data)

        new_content = json.dumps(data, indent=2) + "\n"

        # Check if content actually changed (ignoring simple whitespace diffs if we can, but direct string comparison is safest)
        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
        else:
            print(f"No changes for {filepath}")

    except json.JSONDecodeError:
        print(f"Skipping {filepath} (Invalid JSON or contains comments)")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

if __name__ == "__main__":
    for filepath in sys.argv[1:]:
        process_file(filepath)
