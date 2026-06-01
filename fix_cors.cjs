const fs = require('fs');
let content = fs.readFileSync('e2e/auth-flow.spec.ts', 'utf8');

// Add headers: corsHeaders to any route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
content = content.replace(/await route\.fulfill\(\{ status: 200, contentType: 'application\/json', body: '\{\}' \}\);/g, "await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: '{}' });");

// Add headers: corsHeaders to multi-line route.fulfill missing it
content = content.replace(/status: 200,\s+contentType: 'application\/json',/g, "status: 200,\n                    headers: corsHeaders,\n                    contentType: 'application/json',");

fs.writeFileSync('e2e/auth-flow.spec.ts', content);
