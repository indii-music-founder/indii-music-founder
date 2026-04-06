import os
import re

firebase_required = {
    "db": "{}",
    "auth": "{ currentUser: { uid: 'test-user', email: 'test@example.com' }, onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() }",
    "storage": "{}",
    "functions": "{ region: vi.fn(() => ({ httpsCallable: vi.fn() })) }",
    "functionsWest1": "{ region: vi.fn(() => ({ httpsCallable: vi.fn() })) }",
    "remoteConfig": "{ defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) }",
    "getFirebaseAI": "vi.fn(() => ({}))",
    "app": "{ options: {} }",
    "appCheck": "{ getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) }",
    "messaging": "{ getToken: vi.fn() }"
}

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    pattern = r"vi\.mock\('@/services/firebase',\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\)\);"
    
    def replacement(match):
        inner = match.group(1)
        existing_fields = {}
        clean_inner = re.sub(r'//.*', '', inner)
        clean_inner = re.sub(r'/\*[\s\S]*?\*/', '', clean_inner)
        
        for name in firebase_required.keys():
            if re.search(r'\b' + name + r'\s*:', clean_inner):
                existing_fields[name] = True
        
        missing = [f"{k}: {v}" for k, v in firebase_required.items() if k not in existing_fields]
        if not missing:
            return match.group(0)
        
        new_inner = inner.strip()
        if new_inner and not new_inner.endswith(','):
            new_inner += ","
        
        sep = ",\n    "
        final_inner = new_inner + "\n    " + sep.join(missing)
        return "vi.mock('@/services/firebase', () => ({\n    " + final_inner + "\n}));"

    new_content = re.sub(pattern, replacement, content)
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True
    return False

test_files = []
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.test.ts') or file.endswith('.test.tsx'):
            test_files.append(os.path.join(root, file))

count = 0
for file in test_files:
    if fix_file(file):
        count += 1
print(f"Fixed {count} files.")
