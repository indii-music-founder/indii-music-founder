
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { AI } from '@/services/ai/AIService';

export const LegalTools = {
    analyze_contract: async (args: { fileData: string, mimeType: string }) => {
        try {
            const analyzeContract = httpsCallable(functions, 'analyzeContract');
            const result = await analyzeContract({
                fileData: args.fileData,
                mimeType: args.mimeType || 'application/pdf'
            });
            return JSON.stringify(result.data, null, 2);
        } catch (e: any) {
            return `Contract analysis failed: ${e.message}`;
        }
    },

    draft_contract: async (args: { type: string; parties: string[]; terms: string }) => {
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
                model: 'gemini-1.5-pro-preview-0409',
                contents: { role: 'user', parts: [{ text: prompt }] },
                systemInstruction: systemPrompt
            });

            return response.text();
        } catch (e: any) {
            return `Failed to draft contract: ${e.message}`;
        }
    },

    // Improved generation tool that wraps the AI drafter
    generate_nda: async (args: { parties: string[], purpose: string }) => {
        return LegalTools.draft_contract({
            type: 'Non-Disclosure Agreement',
            parties: args.parties,
            terms: `Purpose: ${args.purpose}. Standard confidentiality obligations apply.`
        });
    }
};
