import re

with open('.agent/test_ledger/OPEN_ISSUES_V2.md', 'r') as f:
    content = f.read()

# Replace any IN PROGRESS that failed
content = re.sub(r'- \*\*Status:\*\* 🟡 IN PROGRESS \(Agent A\)', r'- **Status:** OPEN', content)
content = re.sub(r'- \*\*Status:\*\* 🟡 IN PROGRESS \(Agent B\)', r'- **Status:** OPEN', content)
content = re.sub(r'- \*\*Status:\*\* 🟡 IN PROGRESS \(Agent C\)', r'- **Status:** OPEN', content)

with open('.agent/test_ledger/OPEN_ISSUES_V2.md', 'w') as f:
    f.write(content)
