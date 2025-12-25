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
                model: AI_MODELS.MULTIMODAL.PRO, // Gemini 3 Pro Vision
                contents: {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: args.mime_type, data: args.image_data } }
                    ]
                }
            });

            return res.text();
        } catch (e: any) {
            return `Receipt analysis failed: ${e.message}`;
        }
    }
};
