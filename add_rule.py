import glob

rule_text = """### -1. THE MCLEAR RULE (NEVER DECLARE VICTORY)

> **"Never ever ever declare victory ever."**

Before asserting that a problem is fixed, you MUST rigorously verify it from the user's perspective. Do not say "everything is completely fixed" if there are secondary side effects (like wiped local data) that the user will immediately encounter. State the exact status of the fix, acknowledge any new caveats, and never use the word "victory" or its equivalents.

"""

files = ["AGENTS.md", "CLAUDE.md", "CODEX.md", "DROID.md", "GEMINI.md", "JULES.md", "ANTIGRAVITY.md"]

for f in files:
    try:
        with open(f, 'r') as file:
            content = file.read()
        
        if "THE MCLEAR RULE" not in content:
            content = content.replace("## Operating Principles\n", "## Operating Principles\n\n" + rule_text)
            with open(f, 'w') as file:
                file.write(content)
            print(f"Updated {f}")
    except FileNotFoundError:
        pass
