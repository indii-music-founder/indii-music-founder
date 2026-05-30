import re

with open('packages/firebase/firestore.rules', 'r') as f:
    content = f.read()

# Insert the helpers right below isEmailAuthenticated
helpers = """
    // Check if the authenticated user is Anonymous
    function isAnonymous() {
      return request.auth != null && request.auth.token.firebase.sign_in_provider == 'anonymous';
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

content = re.sub(
    r'(function isEmailAuthenticated\(\) \{[\s\S]*?\n    \})',
    r'\1\n' + helpers,
    content
)

# Now replace isAuthenticated with isVerifiedUser and isOwner with isOwnerWrite
# ONLY on lines that start with allow write, create, update, delete

def replace_line(match):
    line = match.group(0)
    line = line.replace('isAuthenticated()', 'isVerifiedUser()')
    line = line.replace('isOwner(userId)', 'isOwnerWrite(userId)')
    return line

# Match lines that have allow write|create|update|delete...
content = re.sub(r'^[ \t]*allow (write|create|update|delete).*?:.*?$', replace_line, content, flags=re.MULTILINE)

# Some rules have multiline allows. e.g.
# allow create: if isAuthenticated() &&
#    ...
# To be safe, we can just replace 'isAuthenticated()' with 'isVerifiedUser()' in the whole file,
# BUT we don't want to break reads.
# Wait, let's just do a smarter replacement.
# Let's replace 'isAuthenticated()' with 'isVerifiedUser()' everywhere, EXCEPT on 'allow read' lines,
# and EXCEPT inside 'isOwner', 'isOrgMember', 'isAdmin', 'isVerifiedUser', 'isAnonymous'.
