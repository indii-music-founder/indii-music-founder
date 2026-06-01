const fs = require('fs');

let content = fs.readFileSync('e2e/auth-flow.spec.ts', 'utf8');

const helper = `const mockFirestoreUserDoc = async (route) => {
    const url = route.request().url();
    if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
    }
    if (url.includes(':listen') || url.includes('/Listen/') || url.includes('channel?')) {
        await route.fulfill({ status: 403, headers: corsHeaders, contentType: 'application/json', body: '{"error":{"code":403,"message":"Permission Denied"}}' });
        return;
    }
    const postData = route.request().postData() || '';
    const isUserDoc = url.includes('/documents/users/test-user-uid-e2e') || postData.includes('test-user-uid-e2e');

    if (isUserDoc) {
        if (url.includes('batchGet') || url.includes('runQuery')) {
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify([{
                    found: {
                        name: 'projects/mock/databases/(default)/documents/users/test-user-uid-e2e',
                        fields: {
                            uid: { stringValue: 'test-user-uid-e2e' },
                            displayName: { stringValue: 'E2E Test User' },
                            membershipTier: { stringValue: 'pro' },
                            onboardingCompleted: { booleanValue: true },
                        }
                    },
                    readTime: new Date().toISOString()
                }])
            });
            return;
        }
        await route.fulfill({
            status: 200,
            headers: corsHeaders,
            contentType: 'application/json',
            body: JSON.stringify({
                name: 'projects/mock/databases/(default)/documents/users/test-user-uid-e2e',
                fields: {
                    uid: { stringValue: 'test-user-uid-e2e' },
                    displayName: { stringValue: 'E2E Test User' },
                    membershipTier: { stringValue: 'pro' },
                    onboardingCompleted: { booleanValue: true },
                },
            }),
        });
        return;
    }
    await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: '{}' });
};

`;

if (!content.includes('mockFirestoreUserDoc')) {
    const importMatch = content.indexOf('const BASE_URL');
    if (importMatch > -1) {
        content = content.slice(0, importMatch) + helper + content.slice(importMatch);
    }
}

content = content.replace(/await page\.route\('\*\*\/firestore\.googleapis\.com\/\*\*',\s*async\s*route\s*=>\s*\{[\s\S]*?\}\);/g, "await page.route('**/firestore.googleapis.com/**', mockFirestoreUserDoc);");

fs.writeFileSync('e2e/auth-flow.spec.ts', content);
