
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
            // 1. Fetch Content via Browser Agent (Handles JS/SPA)
            if (!window.electronAPI?.agent?.navigateAndExtract) {
                throw new Error('Agent API not available. Are you in the Electron app?');
            }

            console.log('[LicenseScanner] Navigating via Agent:', url);
            const result = await window.electronAPI.agent.navigateAndExtract(url);

            if (!result.success || !result.text) {
                throw new Error(result.error || 'Failed to extract text from page');
            }

            // 2. Truncate content 
            const truncatedContent = result.text.substring(0, 15000);

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

            const schema = {
                type: 'object',
                properties: {
                    licenseType: { type: 'string', enum: ['Royalty-Free', 'Rights-Managed', 'Public Domain', 'Unknown'] },
                    requiresAttribution: { type: 'boolean' },
                    canMonetize: { type: 'boolean' },
                    termsSummary: { type: 'string' },
                    platformName: { type: 'string' }
                },
                required: ['licenseType', 'requiresAttribution', 'canMonetize', 'termsSummary']
            };

            const analysis = await AI.generateStructuredData<LicenseAnalysis>(prompt, schema as any);
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
