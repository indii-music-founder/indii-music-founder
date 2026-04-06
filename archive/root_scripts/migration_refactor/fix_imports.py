import os

def fix_agent_definition(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'freezeAgentConfig' in content and 'import { freezeAgentConfig }' not in content:
        # Add import at the top
        new_content = "import { freezeAgentConfig } from '../FreezeDiagnostic';\n" + content
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True
    return False

def fix_agent_in_root(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'freezeAgentConfig' in content and 'import { freezeAgentConfig }' not in content:
        # Add import at the top
        new_content = "import { freezeAgentConfig } from '@/services/agent/FreezeDiagnostic';\n" + content
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True
    return False

for root, dirs, files in os.walk('src/services/agent/definitions'):
    for file in files:
        if file.endswith('.ts'):
            fix_agent_definition(os.path.join(root, file))

for root, dirs, files in os.walk('src/agents'):
    for file in files:
        if file.endswith('config.ts'):
            fix_agent_in_root(os.path.join(root, file))
