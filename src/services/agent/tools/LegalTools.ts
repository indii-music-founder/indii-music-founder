import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { AI } from '@/services/ai/AIService';
import type { ToolFunctionArgs } from '../types';
import { AI_MODELS } from '@/core/config/ai-models';

// ============================================================================
// Types for LegalTools
// ============================================================================

interface AnalyzeContractArgs extends ToolFunctionArgs {
    fileData: string;
    mimeType: string;
}

interface DraftContractArgs extends ToolFunctionArgs {
    type: string;
    parties: string[];
    terms: string;
}

interface GenerateNdaArgs extends ToolFunctionArgs {
    parties: string[];
    purpose: string;
}

interface ContractAnalysisResult {
    summary?: string;
    clauses?: string[];
    risks?: string[];
    [key: string]: unknown;
}

// ============================================================================
// Helper to extract error message
// ============================================================================

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}

// ============================================================================
// LegalTools Implementation
// ============================================================================

export const LegalTools = {
    analyze_contract: async (args: AnalyzeContractArgs): Promise<string> => {
        try {
            const analyzeContract = httpsCallable<
                { fileData: string; mimeType: string },
                ContractAnalysisResult
            >(functions, 'analyzeContract');

            const result = await analyzeContract({
                fileData: args.fileData,
                mimeType: args.mimeType || 'application/pdf'
            });
            return JSON.stringify(result.data, null, 2);
        } catch (e: unknown) {
            return `Contract analysis failed: ${getErrorMessage(e)}`;
        }
    },

    draft_contract: async (args: DraftContractArgs): Promise<string> => {
        try {
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

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] },
                systemInstruction: systemPrompt
            });

            return response.text();
        } catch (e: unknown) {
            return `Failed to draft contract: ${getErrorMessage(e)}`;
        }
    },

    generate_nda: async (args: GenerateNdaArgs): Promise<string> => {
        return LegalTools.draft_contract({
            type: 'Non-Disclosure Agreement',
            parties: args.parties,
            terms: `Purpose: ${args.purpose}. Standard confidentiality obligations apply.`
        });
    }
};
