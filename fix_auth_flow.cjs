const fs = require('fs');
let content = fs.readFileSync('e2e/auth-flow.spec.ts', 'utf8');

// Replace firestore mock
const oldFirestore = `        // Mock Firestore to prevent network hangs
        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            if (url.includes(':listen') || url.includes('/Listen/') || url.includes('channel?')) {
                await route.abort('failed');
                return;
            }`;

const newFirestore = `        // Mock Firestore to prevent network hangs
        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            if (url.includes(':listen') || url.includes('/Listen/') || url.includes('channel?')) {
                await route.fulfill({ status: 403, headers: corsHeaders, contentType: 'application/json', body: '{"error":{"code":403,"message":"Permission Denied"}}' });
                return;
            }`;

content = content.split(oldFirestore).join(newFirestore);

// Replace identitytoolkit mock
const oldIdentityToolkit = `        // Mock Identity Toolkit for successful login
        await page.route('**/identitytoolkit.googleapis.com/**', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
                return;
            }`;

const newIdentityToolkit = `        // Mock Identity Toolkit for successful login
        await page.route('**/identitytoolkit.googleapis.com/**', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }`;

content = content.split(oldIdentityToolkit).join(newIdentityToolkit);

const oldIdentityToolkit2 = `        // Mock Identity Toolkit and secure token
        await page.route('**/identitytoolkit.googleapis.com/**', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
                return;
            }`;

const newIdentityToolkit2 = `        // Mock Identity Toolkit and secure token
        await page.route('**/identitytoolkit.googleapis.com/**', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }`;

content = content.split(oldIdentityToolkit2).join(newIdentityToolkit2);

// Replace secure token mock
const oldSecureToken = `        await page.route('**/securetoken.googleapis.com/**', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
                return;
            }`;

const newSecureToken = `        await page.route('**/securetoken.googleapis.com/**', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }`;

content = content.split(oldSecureToken).join(newSecureToken);

// Fix remaining occurrences of Access-Control-Allow-Origin header
content = content.replace(/headers: \{ 'Access-Control-Allow-Origin': '\*' \}/g, 'headers: corsHeaders');

fs.writeFileSync('e2e/auth-flow.spec.ts', content);
