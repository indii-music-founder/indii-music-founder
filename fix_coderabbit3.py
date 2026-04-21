import re

with open("packages/firebase/src/relay/agentPrompts.ts", "r") as f:
    content = f.read()

with open("agents/agent0/prompt.md", "r") as f:
    prompt_md = f.read()

# We need to replace the CONDUCTOR_PROMPT inside agentPrompts.ts with the prompt_md text.
# Let's completely reconstruct the file properly since my last edit removed all the other prompts.

# Wait, let's reset the file and do it again properly.
