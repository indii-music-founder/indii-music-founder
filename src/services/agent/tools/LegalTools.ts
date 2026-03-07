import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { LegalService } from '@/services/legal/LegalService';
import { ContractStatus } from '@/modules/legal/types';
import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

// ============================================================================
// Types for LegalTools
// ============================================================================

export const LegalTools: Record<string, AnyToolFunction> = {
    draft_contract: wrapTool('draft_contract', async (args: {
        type: string;
        parties: string[];
        terms: string;
    }) => {
        // Input Validation
        if (!args.type || typeof args.type !== 'string') {
            throw new Error("Validation Error: 'type' is required and must be a string.");
        }
        if (!Array.isArray(args.parties) || args.parties.length === 0) {
            throw new Error("Validation Error: 'parties' must be a non-empty array of strings.");
        }

        const systemPrompt = `
You are a senior entertainment lawyer.
Draft a legally binding contract in Markdown format.
Start the document with a level 1 header "# LEGAL AGREEMENT".
Use standard legal language but keep it readable.
Ensure all parties and terms are clearly defined.
Common types: NDA, Model Release, Location Agreement, Sync License.
Structure with standard clauses: Definitions, Obligations, Term, Termination, Governing Law.
`;
        const prompt = `Draft a ${args.type} between ${args.parties.join(' and ')}.
Key Terms: ${args.terms}`;

        const response = await firebaseAI.generateContent(
            prompt,
            AI_MODELS.TEXT.AGENT,
            undefined,
            systemPrompt
        );

        const content = response.response.text();

        // Auto-persist the contract
        const title = `${args.type} - ${args.parties.join(' & ')}`;
        try {
            const contractId = await LegalService.saveContract({
                title,
                type: args.type,
                parties: args.parties,
                content,
                status: ContractStatus.DRAFT,
                metadata: { terms: args.terms }
            });
            return toolSuccess({
                content,
                contractId,
                title
            }, `Contract draft generated and saved to Legal Dashboard (ID: ${contractId})`);
        } catch (persistError) {
            logger.warn('[LegalTools] Failed to persist contract:', persistError);
            return toolSuccess({
                content
            }, "Contract generated but failed to save to dashboard (Persistence Error).");
        }
    }),

    generate_nda: wrapTool('generate_nda', async (args: {
        parties: string[];
        purpose: string;
    }) => {
        // We reuse the implementation but wrap it in a tool result correctly
        const result = await LegalTools.draft_contract({
            type: 'Non-Disclosure Agreement',
            parties: args.parties,
            terms: `Purpose: ${args.purpose}. Standard confidentiality obligations apply.`
        });
        return result;
    }),

    generate_split_sheet: wrapTool('generate_split_sheet', async (args: {
        trackTitle: string;
        contributors: Array<{ name: string; role: string; percentage: number }>;
    }) => {
        // Validation
        const total = args.contributors.reduce((acc, c) => acc + c.percentage, 0);
        if (total !== 100) {
            return toolSuccess({ error: `Percentages must add up to 100%. Current total: ${total}%` }, 'Failed to generate split sheet');
        }

        const terms = `Track Title: ${args.trackTitle}\nContributors:\n` + args.contributors.map(c => `- ${c.name} (${c.role}): ${c.percentage}%`).join('\n');

        const result = await LegalTools.draft_contract({
            type: 'Split Sheet',
            parties: args.contributors.map(c => c.name),
            terms: terms
        });

        return toolSuccess({
            ...result,
            message: `Split sheet generated for "${args.trackTitle}"`
        }, result.message);
    }),

    trigger_digital_signature: wrapTool('trigger_digital_signature', async (args: {
        contractId: string;
        signers: Array<{ name: string; email: string }>;
        provider?: 'Docusign' | 'PandaDoc';
    }) => {
        const provider = args.provider || 'Docusign';
        logger.info(`[LegalTools] Triggering ${provider} mock API for contract ${args.contractId}`);

        // Mocking the API response
        return toolSuccess({
            contractId: args.contractId,
            provider,
            envelopeId: `mock-env-${crypto.randomUUID()}`,
            status: 'sent',
            sentTo: args.signers.map(s => s.email)
        }, `Digital signature requests sent via ${provider} to ${args.signers.length} signers.`);
    })
};
