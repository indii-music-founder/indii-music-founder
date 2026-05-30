const fs = require('fs');
const file = 'packages/renderer/src/services/agent/tools/SecurityTools.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { isFirebaseE2EMockEnabled }')) {
    content = content.replace("import { logger } from '@/utils/logger';", "import { logger } from '@/utils/logger';\nimport { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';");
}

// In generate_security_report
const reportStart = "    generate_security_report: wrapTool('generate_security_report', async ({ project_id }: { project_id?: string }) => {\n        try {\n";
const reportBypass = "            if (isFirebaseE2EMockEnabled()) {\n                return toolSuccess({ status: 'MOCK_E2E', log_count: 0, logs: [], project_id });\n            }\n";
if (!content.includes("status: 'MOCK_E2E'")) {
    content = content.replace(reportStart, reportStart + reportBypass);
}

// In log_audit_event
const logEventStart = "    log_audit_event: wrapTool('log_audit_event', async (args: { action: string; resourceId: string; severity: 'low' | 'medium' | 'high' | 'critical'; details?: string }) => {\n        try {\n";
const logEventBypass = "            if (isFirebaseE2EMockEnabled()) {\n                return toolSuccess({ logId: 'mock-e2e-log-id', ...args });\n            }\n";
if (!content.includes("logId: 'mock-e2e-log-id'")) {
    content = content.replace(logEventStart, logEventStart + logEventBypass);
}

fs.writeFileSync(file, content);
console.log("Added E2E mock bypasses");
