import os
import json
import argparse
import datetime
import sys

def scan_indii_directory(root_path: str) -> str:
    architecture = {}
    if not os.path.exists(root_path):
        return json.dumps({"error": f"Root path {root_path} not found."}, status=404)

    for agent_dir in os.listdir(root_path):
        agent_path = os.path.join(root_path, agent_dir)
        if os.path.isdir(agent_path):
            architecture[agent_dir] = {
                "path": agent_path,
                "skills": {},
                "instructions_preview": ""
            }
            
            # Read agent instructions if available
            inst_path = os.path.join(agent_path, "instructions.md")
            if not os.path.exists(inst_path):
                inst_path = os.path.join(agent_path, "prompt.md")
                
            if os.path.exists(inst_path):
                with open(inst_path, 'r') as f:
                    architecture[agent_dir]["instructions_preview"] = f.read(200) + "..."

            skills_path = os.path.join(agent_path, "skills")
            if os.path.exists(skills_path):
                for skill in os.listdir(skills_path):
                    skill_path = os.path.join(skills_path, skill)
                    if os.path.isdir(skill_path):
                        skill_data = {"description": "No description found.", "trigger_labels": []}
                        
                        desc_file = os.path.join(skill_path, "description.txt")
                        if os.path.exists(desc_file):
                            try:
                                with open(desc_file, 'r') as f:
                                    lines = f.readlines()
                                    for line in lines:
                                        if line.startswith("description:"):
                                            skill_data["description"] = line.replace("description:", "").strip()
                                        elif "trigger_labels:" in line:
                                            labels_str = line.split("trigger_labels:")[1].strip()
                                            skill_data["trigger_labels"] = [l.strip().strip('"').strip("'") for l in labels_str.strip("[]").split(",")]
                            except Exception as e:
                                skill_data["error"] = str(e)
                                
                        architecture[agent_dir]["skills"][skill] = skill_data
                        
    return json.dumps(architecture, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scan INDII agent directory")
    parser.add_argument("--root", type=str, required=True, help="Absolute path to INDII agents root folder")
    parser.add_argument("--output", type=str, help="Path to save the JSON registry")
    args = parser.parse_args()
    
    registry_json = scan_indii_directory(args.root)
    
    if args.output:
        try:
            data = json.loads(registry_json)
            final_output = {
                "last_updated": datetime.datetime.now().isoformat(),
                "root": args.root,
                "agents": data
            }
            with open(args.output, 'w') as f:
                json.dump(final_output, f, indent=2)
            print(f"Success: Registry saved to {args.output}")
        except Exception as e:
            print(f"Error saving registry: {e}")
            sys.exit(1)
    else:
        print(registry_json)
