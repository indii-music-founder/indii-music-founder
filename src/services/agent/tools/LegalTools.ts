import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { LegalService } from '@/services/legal/LegalService';
import { ContractStatus } from '@/modules/legal/types';
import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// Types for LegalTools
// ============================================================================

export const LegalTools: Record<string, AnyToolFunction> = {
    draft_contract: wrapTool('draft_contract', async (args: {
        type: string;
        parties: string[];
        terms: string;
    }) => {
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
            console.warn('Failed to persist contract:', persistError);
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
    })
};
