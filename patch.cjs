const fs = require('fs');
const p = 'packages/firebase/src/functions/analytics/bigquery-pipeline.ts';
let code = fs.readFileSync(p, 'utf8');
code = code.replace(
  "import { BigQuery } from '@google-cloud/bigquery';",
  "import { BigQuery } from '@google-cloud/bigquery';\nimport * as crypto from 'crypto';"
);
code = code.replace(
  "function generateIdempotencyKey(event: AnalyticsEvent): string {\n  const hash = crypto.randomUUID().split('-')[0];\n  return `${event.userId}-${event.eventType}-${event.timestamp}-${hash}`;\n}",
  "function generateIdempotencyKey(event: AnalyticsEvent): string {\n  const dataString = JSON.stringify(event.data || {});\n  const hash = crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 8);\n  return event.eventId || `${event.userId}-${event.eventType}-${event.timestamp}-${hash}`;\n}"
);
fs.writeFileSync(p, code);
