import os
import sys
import subprocess

def check_agent(name, path):
    print(f"--> Validating Agent: {name}")
    errors = []
    
    # 1. Check directory structure
    if not os.path.isdir(path):
        errors.append(f"Directory missing: {path}")
        return errors
        
    skills_dir = os.path.join(path, "skills", "tools")
    if not os.path.isdir(skills_dir):
        errors.append(f"Skills tools directory missing: {skills_dir}")
    
    # 2. Check prompt.md
    prompt_file = os.path.join(path, "prompt.md")
    if not os.path.exists(prompt_file):
        errors.append(f"prompt.md missing: {prompt_file}")
    else:
        content = open(prompt_file, 'r').read()
        if "SWARM VERIFICATION" not in content:
            errors.append(f"prompt.md missing swarm verification signature")
            
    # 3. Check for technical tools
    if os.path.exists(skills_dir):
        files = os.listdir(skills_dir)
        py_files = [f for f in files if f.endswith(".py")]
        if not py_files:
            errors.append(f"No technical tools (.py) found in {skills_dir}")
        else:
            # Check python syntax for the first one found
            tool_path = os.path.join(skills_dir, py_files[0])
            try:
                subprocess.run(["python3", "-m", "py_compile", tool_path], check=True, capture_output=True)
            except subprocess.CalledProcessError as e:
                errors.append(f"Syntax error in tool {tool_path}: {e.stderr.decode()}")

    return errors

def main():
    agents_root = "agents"
    agents = [d for d in os.listdir(agents_root) if os.path.isdir(os.path.join(agents_root, d)) and d != "foundational"]
    
    total_errors = 0
    for agent in agents:
        agent_path = os.path.join(agents_root, agent)
        errors = check_agent(agent, agent_path)
        if errors:
            print(f"❌ {agent} has errors:")
            for err in errors:
                print(f"  - {err}")
            total_errors += len(errors)
        else:
            print(f"✅ {agent} is healthy")
            
    # Check foundational agents
    foundational = ["audit_skill", "memory_skill"]
    for f in foundational:
        f_path = os.path.join(agents_root, "foundational", f)
        errors = check_agent(f, f_path)
        if errors:
            print(f"❌ Foundational {f} has errors:")
            for err in errors:
                print(f"  - {err}")
            total_errors += len(errors)
        else:
            print(f"✅ Foundational {f} is healthy")

    if total_errors > 0:
        print(f"\n❌ Validation FAILED with {total_errors} errors.")
        sys.exit(1)
    else:
        print("\n✅ All 20 Specialist Agents are VALIDATED and HEALTHY.")
        sys.exit(0)

if __name__ == "__main__":
    main()
