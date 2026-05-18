import os

replacements = {
    "indiios-v-1-1": "YOUR_FIREBASE_PROJECT_ID",
    "indiios-studio": "YOUR_FIREBASE_STUDIO_APP_ID",
    "indiios-alpha-electron": "YOUR_FIREBASE_ELECTRON_APP_ID",
    "the-walking-agency-det": "wiil-tech"
}

excluded_dirs = {".git", "node_modules", "dist", "build", ".next", ".agent"}

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (UnicodeDecodeError, FileNotFoundError):
        return

    original = content
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in excluded_dirs]
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.mjs', '.json', '.sh', '.md', '.py', '.yml', '.yaml', 'env.example')):
            process_file(os.path.join(root, file))

print("Replacement complete.")
