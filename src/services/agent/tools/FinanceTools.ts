import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const FinanceTools: Record<string, AnyToolFunction> = {
    analyze_receipt: wrapTool('analyze_receipt', async (args: { image_data: string, mime_type: string }) => {
        const { firebaseAI } = await import('@/services/ai/FirebaseAIService');

        // Construct Multimodal Prompt
        const prompt = `You are an expert accountant. Extract the following data from this receipt image:
        1. Vendor Name
        2. Date
        3. Total Amount
        4. Expense Category (Travel, Equipment, Meals, Marketing, Other)
        5. Brief Description
        
        Output strictly in JSON format: { "vendor": string, "date": string, "amount": number, "category": string, "description": string }`;

        const res = await firebaseAI.generateContent(
            [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: args.mime_type, data: args.image_data } }
                    ]
                }
            ],
            AI_MODELS.TEXT.AGENT
        );

        // Access the text from the response object
        const text = res.response.text();

        return {
            raw_data: text,
            message: "Receipt analysis completed."
        };
    }),

    audit_distribution: wrapTool('audit_distribution', async (args: { trackTitle: string; distributor: string }) => {
        const { DISTRIBUTORS } = await import('@/core/config/distributors');

        // 1. Check Distributor Config
        const distConfig = DISTRIBUTORS[args.distributor as keyof typeof DISTRIBUTORS];
        if (!distConfig) {
            return toolError(`Distributor '${args.distributor}' is not in the approved database.`, "UNKNOWN_DISTRIBUTOR");
        }

        return {
            status: "READY_FOR_AUDIT",
            distributor: distConfig.name,
            party_id: distConfig.ddexPartyId,
            message: `Distribution channel '${distConfig.name}' verified. Recipient Party ID: ${distConfig.ddexPartyId}. Ready to generate ERN.`
        };
    })
};
