import fs from 'fs';
import path from 'path';

const agentsPath = path.join(process.cwd(), 'agents');
if (fs.existsSync(agentsPath)) {
    const dirs = fs.readdirSync(agentsPath).filter(d => fs.statSync(path.join(agentsPath, d)).isDirectory());

    for (const dir of dirs) {
        const indexTs = path.join(agentsPath, dir, 'src', 'index.ts');
        if (fs.existsSync(indexTs)) {
            let content = fs.readFileSync(indexTs, 'utf8');

            content = content.replace(/import\s*\{\s*Agent\s*,\s*createTool\s*\}\s*from\s*'@mastra\/core';/g, "import { Agent } from '@mastra/core/agent';\nimport { createTool } from '@mastra/core/tools';");
            content = content.replace(/import\s*\{\s*Agent\s*\}\s*from\s*'@mastra\/core';/g, "import { Agent } from '@mastra/core/agent';");
            content = content.replace(/import\s*\{\s*createTool\s*\}\s*from\s*'@mastra\/core';/g, "import { createTool } from '@mastra/core/tools';");

            content = content.replace(/BrowserTools\.browser_tool(\s*\()/g, "BrowserTools.browser_action$1");

            const toolsToAssert = ['DirectorTools', 'MarketingTools', 'SovereignTools', 'BrowserTools', 'KnowledgeTools'];
            for (const tool of toolsToAssert) {
                const regex = new RegExp(`(${tool}\\.[a-zA-Z0-9_]+)(\\s*\\()`, 'g');
                content = content.replace(regex, (match, prefix, suffix) => {
                    if (!prefix.endsWith('!')) {
                        return `${prefix}!${suffix}`;
                    }
                    return match;
                });
            }

            fs.writeFileSync(indexTs, content, 'utf8');
        }
    }
    console.log('Fixed agent imports and strict null checks.');
}
