import argparse
import os

import subprocess

def update_knowledge(file_path: str, action: str, content: str) -> None:
    if not os.path.exists(file_path):
        print(f"Error: Target file not found at {file_path}")
        return

    content = content.strip()
    with open(file_path, 'r') as file:
        lines = [line.strip() for line in file.readlines()]

    if action == 'add':
        if content in lines:
            print(f"Skipped: Rule already exists in {file_path}")
            return
        
        with open(file_path, 'a') as file:
            file.write(f"\n{content}\n")
        status = f"Success: Content appended to {file_path}"
        
    elif action == 'remove':
        original_count = len(lines)
        lines = [line for line in lines if content not in line]
        if len(lines) == original_count:
            status = f"No Action: Target content not found in {file_path}"
            print(status)
            return
        
        with open(file_path, 'w') as file:
            file.write("\n".join(lines) + "\n")
        status = f"Success: Target content removed from {file_path}"
        
    else:
        print("Error: Invalid action specified.")
        return

    # Git integration: Commit the change
    try:
        subprocess.run(["git", "add", file_path], check=True, capture_output=True)
        commit_msg = f"chore(agent-memory): {action} knowledge in {os.path.basename(file_path)}"
        subprocess.run(["git", "commit", "-m", commit_msg], check=True, capture_output=True)
        status += " (Changes committed to Git)"
    except Exception as e:
        status += f" (Git commit failed: {str(e)})"
    
    print(status)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rewrite agent instruction files")
    parser.add_argument("--file_path", type=str, required=True, help="Path to the instruction.md file")
    parser.add_argument("--action", choices=['add', 'remove'], required=True, help="Rewrite operation type")
    parser.add_argument("--content", type=str, required=True, help="String to inject or excise")
    args = parser.parse_args()
    update_knowledge(args.file_path, args.action, args.content)
