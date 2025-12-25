
import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

export interface LicenseAnalysis {
    licenseType: 'Royalty-Free' | 'Rights-Managed' | 'Public Domain' | 'Unknown';
    requiresAttribution: boolean;
    canMonetize: boolean;
    termsSummary: string;
    platformName?: string;
}

export class LicenseScannerService {

    /**
     * Scans a URL for license terms using AI.
     * 1. Fetches HTML content via Main process (bypass CORS).
     * 2. Sends content to Gemini for analysis.
     */
    async scanUrl(url: string): Promise<LicenseAnalysis> {
        try {
            // 1. Fetch Content (Bypass CORS)
            if (!window.electronAPI?.network?.fetchUrl) {
                throw new Error('Network API not available. Are you in the Electron app?');
            }

            console.log('[LicenseScanner] Fetching URL:', url);
            const htmlContent = await window.electronAPI.network.fetchUrl(url);

            // 2. Truncate content to avoid token limits (keep first 15k chars, usually contains header/terms)
            const truncatedContent = htmlContent.substring(0, 15000);

            // 3. AI Analysis
            const prompt = `
                Analyze the following webpage content (likely a music sample pack or Terms of Service page).
                Extract the license rights for using these audio samples in a commercial music release.

                URL: ${url}

                Content Snippet:
                ${truncatedContent}
                
                Return JSON only matching this schema:
                {
                    "licenseType": "Royalty-Free" | "Rights-Managed" | "Public Domain" | "Unknown",
                    "requiresAttribution": boolean,
                    "canMonetize": boolean,
                    "termsSummary": "One sentence summary of key restrictions or allowances.",
                    "platformName": "Name of the platform/website"
                }
            `;

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST, // Use Flash for speed
                contents: {
                    role: 'user',
                    parts: [{ text: prompt }]
                },
                config: {
                    responseMimeType: 'application/json'
                }
            });

            const analysis = AI.parseJSON(response.text()) as LicenseAnalysis;
            return analysis;

        } catch (error) {
            console.error('[LicenseScanner] Scan failed:', error);
            return {
                licenseType: 'Unknown',
                requiresAttribution: false,
                canMonetize: false,
                termsSummary: 'Scan failed. Please verify manually.'
            };
        }
    }
}

export const licenseScannerService = new LicenseScannerService();
