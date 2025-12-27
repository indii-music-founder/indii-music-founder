import { AI_MODELS } from '@/core/config/ai-models';
import type { ToolFunctionArgs } from '../types';

interface AnalyzeReceiptArgs extends ToolFunctionArgs {
    image_data: string; // Base64 or URL
    mime_type: string;
}

export const FinanceTools = {
    analyze_receipt: async (args: AnalyzeReceiptArgs): Promise<string> => {
        try {
            const { AI } = await import('@/services/ai/AIService');

            // Construct Multimodal Prompt
            const prompt = `You are an expert accountant. Extract the following data from this receipt image:
            1. Vendor Name
            2. Date
            3. Total Amount
            4. Expense Category (Travel, Equipment, Meals, Marketing, Other)
            5. Brief Description
            
            Output strictly in JSON format: { "vendor": string, "date": string, "amount": number, "category": string, "description": string }`;

            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT, // Gemini 3 Pro (Multimodal)
                contents: {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: args.mime_type, data: args.image_data } }
                    ]
                }
            });

            return res.text();
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            return `Receipt analysis failed: ${errorMessage}`;
        }
    },

    audit_distribution: async (args: { trackTitle: string; distributor: string }): Promise<string> => {
        try {
            const { ernService } = await import('@/services/ddex/ERNService');
            const { DISTRIBUTORS } = await import('@/core/config/distributors');

            // 1. Check Distributor Config
            const distConfig = DISTRIBUTORS[args.distributor as keyof typeof DISTRIBUTORS];
            if (!distConfig) {
                return JSON.stringify({
                    status: "UNKNOWN_DISTRIBUTOR",
                    risk: "HIGH",
                    message: `Distributor '${args.distributor}' is not in the approved database.`,
                    action: "Configure distributor settings."
                });
            }

            // 2. Mock Metadata Retrieval (In real app, fetch from store)
            // For now, we simulate a check based on "context" or return a template
            // asking the user to provide the metadata if not available.
            // Ideally, this tool would accept the metadata ID, but for the MVP prompt:

            return JSON.stringify({
                status: "READY_FOR_AUDIT",
                distributor: distConfig.name,
                party_id: distConfig.ddexPartyId,
                message: `Distribution channel '${distConfig.name}' verified. Recipient Party ID: ${distConfig.ddexPartyId}. Ready to generate ERN.`
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return `Audit failed: ${errorMessage}`;
        }
    }
};
