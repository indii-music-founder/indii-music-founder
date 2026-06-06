const fs = require('fs');
const p = 'packages/firebase/src/index.ts';
let code = fs.readFileSync(p, 'utf8');

const target = `        // Perform mock enrichment based on provided fans array
        const enriched = fans.map(fan => {
            return {
                ...fan,
                enrichedAt: new Date().toISOString(),
                lifetimeValueScore: Math.floor(Math.random() * 100),
                socialReach: 'unknown'
            };
        });

        return {
             results: enriched,
             metadata: {
                 provider: normalizedProvider,
                 count: enriched.length,
                 timestamp: new Date().toISOString()
             }
        };`;

const replacement = `        // TODO: Implement actual fan data enrichment with third-party providers (e.g. Chartmetric, SpotOn).
        throw new functions.https.HttpsError(
            "unimplemented",
            \`Enrichment provider '\${normalizedProvider}' is not configured or implemented yet.\`
        );`;

code = code.replace(target, replacement);
fs.writeFileSync(p, code);
