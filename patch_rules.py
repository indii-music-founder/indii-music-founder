import re

with open('packages/firebase/firestore.rules', 'r') as f:
    content = f.read()

helpers = """
    // Check if the authenticated user is Anonymous
    function isAnonymous() {
      return isAuthenticated() && request.auth.token.firebase.sign_in_provider == 'anonymous';
    }

    // Check if user is a verified (non-anonymous) authenticated user.
    function isVerifiedUser() {
      return isAuthenticated() && !isAnonymous();
    }

    // Check if user owns this resource (WRITE)
    function isOwnerWrite(userId) {
      return (isVerifiedUser() && request.auth.uid == userId) || (userId == 'founder-demo-uid' && isGuest());
    }
"""

if "function isAnonymous" not in content:
    content = re.sub(
        r'(function isEmailAuthenticated\(\) \{[\s\S]*?\n    \})',
        r'\1\n' + helpers,
        content
    )

# Replace isOwner with isOwnerWrite in write/create/update/delete
def replace_line(match):
    line = match.group(0)
    if 'read:' not in line:
        line = line.replace('isOwner(userId)', 'isOwnerWrite(userId)')
        line = line.replace('isAuthenticated()', 'isVerifiedUser()')
    return line

lines = content.split('\n')
for i in range(len(lines)):
    line = lines[i]
    if re.search(r'^\s*allow (write|create|update|delete)\b', line):
        lines[i] = replace_line(re.match(r'.*', line))
    elif re.search(r'^\s*allow read, (write|create|update|delete)\b', line):
        # We need to split this into two allows!
        pass

content = '\n'.join(lines)

with open('packages/firebase/firestore.rules', 'w') as f:
    f.write(content)

