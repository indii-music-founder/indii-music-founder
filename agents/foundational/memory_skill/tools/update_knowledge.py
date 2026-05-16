import os
import argparse
import subprocess

def update_agent_instructions(file_path, action, content):
    if not os.path.exists(file_path):
        # Try prompt.md if instructions.md doesn't exist
        if "instructions.md" in file_path:
            file_path = file_path.replace("instructions.md", "prompt.md")
        
        if not os.path.exists(file_path):
            return f"Error: File {file_path} not found."

    try:
        with open(file_path, 'r') as f:
            lines = f.readlines()

        if action == 'add':
            # Deduplicate
            if content.strip() in [l.strip() for l in lines]:
                return f"Success: Content already exists in {file_path}"
            
            with open(file_path, 'a') as f:
                f.write(f"\n{content}\n")
            msg = f"Success: Content appended to {file_path}"
        
        elif action == 'remove':
            new_lines = [l for l in lines if content not in l]
            with open(file_path, 'w') as f:
                f.writelines(new_lines)
            msg = f"Success: Content removed from {file_path}"
        
        else:
            return "Error: Invalid action. Use 'add' or 'remove'."

        # Git commit
        try:
            subprocess.run(["git", "add", file_path], check=True)
            subprocess.run(["git", "commit", "-m", f"chore(agent-memory): {action} knowledge in {os.path.basename(file_path)}"], check=True)
            msg += " (Changes committed to Git)"
        except Exception as ge:
            msg += f" (Git commit failed: {ge})"

        return msg

    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update agent persistent knowledge")
    parser.add_argument("--file_path", required=True)
    parser.add_argument("--action", choices=['add', 'remove'], required=True)
    parser.add_argument("--content", required=True)
    args = parser.parse_args()
    
    print(update_agent_instructions(args.file_path, args.action, args.content))
