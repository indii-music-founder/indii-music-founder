const fs = require('fs');

const files = [
    'packages/main/src/services/AuthStorage.ts',
    'packages/main/src/services/BrowserAgentService.ts',
    'packages/main/src/services/CredentialService.ts',
    'packages/main/src/services/IndiiRemoteService.ts',
    'packages/main/src/services/SFTPService.ts',
    'packages/renderer/src/modules/analytics/components/CustomizableAnalyticsDashboard.tsx',
    'packages/renderer/src/modules/creative/video/editor/components/EditorAssetLibrary.tsx',
    'packages/renderer/src/services/marketing/CampaignIntelligenceService.ts'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    // Remove lines that only contain void 0;
    content = content.replace(/^[ \t]*void 0;[ \t]*\n/gm, '');
    // Also remove inline ones like in .catch
    content = content.replace(/void 0;/g, '');
    fs.writeFileSync(file, content, 'utf8');
}
console.log('Fixed void 0; in multiple files.');
