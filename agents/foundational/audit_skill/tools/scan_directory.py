import os
import json
import argparse

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
                                            # Simple parse for labels
                                            labels_str = line.split("trigger_labels:")[1].strip()
                                            skill_data["trigger_labels"] = [l.strip().strip('"').strip("'") for l in labels_str.strip("[]").split(",")]
                            except Exception as e:
                                skill_data["error"] = str(e)
                                
                        architecture[agent_dir]["skills"][skill] = skill_data
                        
    return json.dumps(architecture, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scan INDII agent directory")
    parser.add_argument("--root", type=str, required=True, help="Absolute path to INDII agents root folder")
    args = parser.parse_args()
    print(scan_indii_directory(args.root))
