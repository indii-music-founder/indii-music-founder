import os
import sys

def check_conflicts():
    print("Scanning for merge conflicts...")
    conflicts = []
    for root, dirs, files in os.walk("."):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if ".git" in dirs:
            dirs.remove(".git")
        for file in files:
            path = os.path.join(root, file)
            try:
                with open(path, "r", errors="ignore") as f:
                    content = f.read()
                    if "<<<<<<<" in content and ">>>>>>>" in content:
                        conflicts.append(path)
            except Exception:
                pass
    return conflicts

if __name__ == "__main__":
    conflicts = check_conflicts()
    if conflicts:
        print(f"CRITICAL: Found conflicts in {len(conflicts)} files:")
        for c in conflicts:
            print(f"  - {c}")
        sys.exit(1)
    else:
        print("RESULT: No merge conflicts detected.")
        sys.exit(0)
