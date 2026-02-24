import { AgentContext } from './types';
import { agentService } from './AgentService';
import { v4 as uuidv4 } from 'uuid';

/**
 * OrchestrationService manages complex, multi-agent workflows.
 * It coordinates specialist agents (Brand, Publicist, Marketing, Security)
 * to achieve high-level goals like "Launch a full campaign".
 */
export class OrchestrationService {

    /**
     * Executes a full Campaign Launch workflow.
     * sequence:
     * 1. Brand Agent: Audit existing assets and identity.
     * 2. Publicist Agent: Draft press release and generate PDF.
     * 3. Marketing Agent: Analyze trends and create strategy.
     * 4. Social Agent: Prepare social drop posts.
     */
    async launchCampaign(projectId: string, userIntent: string, context: AgentContext): Promise<string> {
        const traceId = uuidv4();
        console.info(`[Orchestration] Starting Campaign Launch for project: ${projectId}, trace: ${traceId}`);

        let report = `# 🚀 Campaign Launch Report\n\n**Goal**: ${userIntent}\n\n---\n\n`;

        try {
            // STEP 1: BRAND AUDIT
            console.info('[Orchestration] Step 1: Requesting Brand Audit...');
            const brandResult = await agentService.runAgent(
                'brand',
                `Analyze the brand consistency and identity for this project based on current assets. Intent: ${userIntent}`,
                context,
                traceId
            );
            report += `## 🎨 Brand Audit\n${brandResult.text}\n\n---\n\n`;

            // STEP 2: PUBLICIST - PRESS RELEASE
            console.info('[Orchestration] Step 2: Generating Press Release...');
            const publicistResult = await agentService.runAgent(
                'publicist',
                `Generate a professional press release and PDF for this campaign. Context: ${userIntent}`,
                context,
                traceId
            );
            report += `## 📰 Publicity & PR\n${publicistResult.text}\n\n---\n\n`;

            // STEP 3: MARKETING STRATEGY
            console.info('[Orchestration] Step 3: Analyzing Market Trends...');
            const marketingResult = await agentService.runAgent(
                'marketing',
                `Analyze current market trends and provide a 4-week marketing strategy for this release. Intent: ${userIntent}`,
                context,
                traceId
            );
            report += `## 📈 Marketing Strategy\n${marketingResult.text}\n\n---\n\n`;

            // STEP 4: SOCIAL DROPS
            console.info('[Orchestration] Step 4: Preparing Social Content...');
            const socialResult = await agentService.runAgent(
                'social',
                `Prepare at least 3 social drop post drafts (TikTok, Instagram, Twitter) for this campaign.`,
                context,
                traceId
            );
            report += `## 📱 Social Drops\n${socialResult.text}\n\n---\n\n`;

            report += `✅ **Orchestration Complete.** All specialist outputs have been synthesized above.`;
            return report;

        } catch (error: any) {
            console.error('[Orchestration] Campaign Launch failed:', error);
            return `❌ **Campaign Launch Interrupted**: ${error.message}. Partial progress saved in project logs.`;
        }
    }

    /**
     * General purpose orchestration router.
     * Detects if a request is an indiiOS "Master Workflow".
     */
    async executeOrchestratedWorkflow(intent: string, context: AgentContext): Promise<string | null> {
        const lower = intent.toLowerCase();

        // Campaign Triggers
        if (lower.includes('launch') && (lower.includes('campaign') || lower.includes('release'))) {
            if (!context.projectId) throw new Error("A project must be active to launch a campaign.");
            return this.launchCampaign(context.projectId, intent, context);
        }

        // Add more master workflows here (e.g. "Security Audit", "Tour Planning")
        return null;
    }
}

export const orchestrationService = new OrchestrationService();
