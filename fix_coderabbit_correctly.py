import re

with open("packages/firebase/src/relay/agentPrompts.ts", "r") as f:
    content = f.read()

with open("agents/agent0/prompt.md", "r") as f:
    prompt_md = f.read()

start_idx = content.find("const CONDUCTOR_PROMPT = `# indii Conductor — System Prompt")
if start_idx != -1:
    end_idx = content.find("`;\n\n// ---------------------------------------------------------------------------\n// Specialist Prompts", start_idx)

    # Let's just find the exact string to replace it with
    end_pattern = "`;\n\n// ---------------------------------------------------------------------------\n// Specialist Prompts"
    end_idx = content.find(end_pattern, start_idx)
    if end_idx != -1:
        new_content = content[:start_idx] + f"const CONDUCTOR_PROMPT = `{prompt_md}`" + content[end_idx:]
        with open("packages/firebase/src/relay/agentPrompts.ts", "w") as f:
            f.write(new_content)
        print("Updated CONDUCTOR_PROMPT in agentPrompts.ts")
    else:
        print("Could not find end of CONDUCTOR_PROMPT")
else:
    print("Could not find start of CONDUCTOR_PROMPT")
