const fs = require('fs');
const file = 'packages/firebase/firestore.rules';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`    match /audit_logs/{id} {
      allow read: if isAdmin();
      allow create: if false;
    }`,
`    match /audit_logs/{id} {
      allow read: if isAdmin() || (isAuthenticated() && resource.data.userId == request.auth.uid);
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid && request.resource.data.source == 'Agent_SecurityTools';
    }`);

fs.writeFileSync(file, content);
