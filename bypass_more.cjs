const fs = require('fs');
const file = 'packages/renderer/src/services/agent/tools/SecurityTools.ts';
let content = fs.readFileSync(file, 'utf8');

const apiStart = "    check_api_status: wrapTool('check_api_status', async ({ api_name }: { api_name: string }) => {\n";
const apiBypass = "        if (isFirebaseE2EMockEnabled()) {\n            return toolSuccess({ api: api_name, status: 'ONLINE', message: 'E2E mock bypass' });\n        }\n";
content = content.replace(apiStart, apiStart + apiBypass);

const auditStart = "    audit_permissions: wrapTool('audit_permissions', async ({ project_id }: { project_id?: string }) => {\n";
const auditBypass = "        if (isFirebaseE2EMockEnabled()) {\n            return toolSuccess({ project_id, status: 'MOCK_E2E', roles: {} });\n        }\n";
content = content.replace(auditStart, auditStart + auditBypass);

fs.writeFileSync(file, content);
