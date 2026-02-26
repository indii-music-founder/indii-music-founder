import { BrandAgent } from './src/services/agent/definitions/BrandAgent.js';
import { MarketingAgent } from './src/services/agent/definitions/MarketingAgent.js';
import { DistributionAgent } from './src/services/agent/definitions/DistributionAgent.js';

// Note: We need .js extensions for ESM in Node or use a loader.
// Since these are TS files, Node won't run them directly without a transpiler.
// I'll try running it through vitest again but with a different cache dir to bypass EPERM.

function checkAgent(agent, toolName, requiredParams) {
    const tool = agent.tools?.flatMap(t => t.functionDeclarations).find(f => f.name === toolName);
    if (!tool) {
        console.error(`[FAIL] ${agent.id}: Tool ${toolName} not found`);
        return false;
    }
    const actual = tool.parameters?.required || [];
    const missing = requiredParams.filter(p => !actual.includes(p));
    if (missing.length > 0) {
        console.error(`[FAIL] ${agent.id}: Tool ${toolName} missing required params: ${missing.join(', ')}`);
        console.error(`[DEBUG] Actual:`, actual);
        return false;
    }

    // Test immutability
    try {
        tool.parameters.required.push('rogue_param');
        if (tool.parameters.required.includes('rogue_param')) {
            console.error(`[FAIL] ${agent.id}: Schema is NOT frozen! Mutation succeeded.`);
            return false;
        }
    } catch (e) {
        // Expected if frozen
    }

    console.log(`[PASS] ${agent.id}: Tool ${toolName} validated (Frozen)`);
    return true;
}

const results = [
    checkAgent(BrandAgent, 'analyze_brand_consistency', ['content', 'type']),
    checkAgent(MarketingAgent, 'generate_campaign_from_audio', []), // Note: required was empty in source
    checkAgent(DistributionAgent, 'prepare_release', ['title', 'artist', 'upc', 'isrc'])
];

if (results.every(r => r === true)) {
    console.log("All manual agent checks passed.");
    process.exit(0);
} else {
    process.exit(1);
}
