import { FirebaseIntelligenceService } from '@/services/intelligence/FirebaseIntelligenceService';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { judgeExpenseCategorization } from '@/config/typesafeJudgments';
import { logger } from '@/utils/logger';
import type { Content } from '@/shared/types/ai.dto';

export interface ReceiptData {
    amount: number;
    currency: string;
    vendor: string;
    date: string;
    category: 'transport' | 'lodging' | 'meals' | 'equipment' | 'other';
    confidence: number;
    extractedText?: string;
    isTaxDeductible?: boolean;
}

export class ReceiptOCRService {
    private aiService: FirebaseIntelligenceService;

    constructor() {
        this.aiService = new FirebaseIntelligenceService();
    }

    /**
     * Process a receipt image and extract structured financial data.
     * @param file The image file (JPG/PNG)
     * @returns Structured receipt data
     */
    async processReceipt(file: File): Promise<ReceiptData> {
        try {
            // Convert file to base64 for Gemini parts API
            const base64Data = await this.fileToBase64(file);

            const prompt = `
                Analyze this receipt image and extract the following information in JSON format:
                - amount (number)
                - currency (string, e.g. "USD", "EUR")
                - vendor (string)
                - date (string, YYYY-MM-DD)
                - category (one of: "transport", "lodging", "meals", "equipment", "other")
                - confidence (number 0-1)

                If you cannot find a field, return null for that field. 
                Focus on the TOTAL amount.
            `;

            // Item 350: Typed as Content[] to remove `as any` cast
            const contents: Content[] = [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: file.type,
                                data: base64Data.split(',')[1]! // Remove data:image/png;base64, prefix
                            }
                        }
                    ]
                }
            ];

            const result = await this.aiService.rawGenerateContent(
                contents,
                INTELLIGENCE_MODELS.TEXT.FAST, // Gemini 3.8 Flash multimodal OCR
                {
                    responseMimeType: 'application/json'
                }
            );

            const text = result.response.text();
            const data = JSON.parse(text) as ReceiptData;

            // Refine expense deductibility via TypeSafe Jev AI (System One)
            let isTaxDeductible: boolean | undefined = undefined;
            if (data.vendor) {
                try {
                    const jevVerdict = await judgeExpenseCategorization(data.vendor, text, data.amount);
                    if (jevVerdict) {
                        isTaxDeductible = jevVerdict.isTaxDeductible;
                    }
                } catch (jevErr) {
                    logger.debug('[ReceiptOCR] Jev expense judgment skipped:', jevErr);
                }
            }

            logger.info('[ReceiptOCR] Successfully extracted data:', data);
            return {
                ...data,
                isTaxDeductible,
                extractedText: text
            };

        } catch (error: unknown) {
            logger.error('[ReceiptOCR] Failed to process receipt:', error);
            throw error;
        }
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }
}

export const receiptOCRService = new ReceiptOCRService();
