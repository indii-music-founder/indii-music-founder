import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicensingAgent } from './LicensingAgent';
import { licensingService } from '../../licensing/LicensingService';
import { licenseScannerService } from '../../knowledge/LicenseScannerService';

vi.mock('../../licensing/LicensingService', () => ({
    licensingService: {
        createRequest: vi.fn(),
        updateRequest: vi.fn(),
        updateRequestStatus: vi.fn()
    }
}));

vi.mock('../../knowledge/LicenseScannerService', () => ({
    licenseScannerService: {
        scanUrl: vi.fn()
    }
}));

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/licensing/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateText: vi.fn(),
        analyzeImage: vi.fn()
    }
}));

import { firebaseAI } from '@/services/ai/FirebaseAIService';

vi.mock('../tools/LegalTools', () => ({
    LegalTools: {
        draft_contract: vi.fn()
    }
}));

vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT: {
            FAST: 'mock-model-fast',
            AGENT: 'mock-model-agent'
        }
    },
    AI_CONFIG: {
        THINKING: {
            HIGH: { thinkingConfig: { thinkingLevel: "HIGH" } }
        }
    }
}));

describe('LicensingAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('check_availability', () => {
        it('should handle availability check with URL scanning', async () => {
            const mockScanResult = {
                licenseType: 'Royalty-Free',
                termsSummary: 'Free for use',
                isCommercialAllowed: true
            };
            vi.mocked(licenseScannerService.scanUrl).mockResolvedValue(mockScanResult as any);
            vi.mocked(licensingService.createRequest).mockResolvedValue('new-request-id');

            const args = {
                title: 'Test Track',
                artist: 'Test Artist',
                usage: 'Commercial Video',
                url: 'https://example.com/license'
            };

            const result = await (LicensingAgent.functions!.check_availability as Function)(args);

            expect(licenseScannerService.scanUrl).toHaveBeenCalledWith(args.url);
            expect(licensingService.createRequest).toHaveBeenCalledWith(expect.objectContaining({
                title: args.title,
                status: 'checking'
            }));

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('available');
            expect(result.data.requestId).toBe('new-request-id');
        });

        it('should handle restricted licenses identified by AI', async () => {
            const mockScanResult = {
                licenseType: 'Rights-Managed',
                termsSummary: 'Negotiation required',
                isCommercialAllowed: false
            };
            vi.mocked(licenseScannerService.scanUrl).mockResolvedValue(mockScanResult as any);
            vi.mocked(licensingService.createRequest).mockResolvedValue('restricted-request-id');

            const args = {
                title: 'Famous Song',
                artist: 'Famous Artist',
                usage: 'Film Sync',
                url: 'https://label.com/rights'
            };

            const result = await (LicensingAgent.functions!.check_availability as Function)(args);

            expect(result.data.status).toBe('restricted');
            expect(result.data.requestId).toBe('restricted-request-id');
        });

        it('should default to pending if no URL is provided', async () => {
            vi.mocked(licensingService.createRequest).mockResolvedValue('pending-request-id');

            const args = {
                title: 'Unknown Track',
                artist: 'Unknown Artist',
                usage: 'Background music'
            };

            const result = await (LicensingAgent.functions!.check_availability as Function)(args);

            expect(licenseScannerService.scanUrl).not.toHaveBeenCalled();
            expect(result.data.status).toBe('pending');
            expect(result.data.requestId).toBe('pending-request-id');
        });
    });

    describe('analyze_contract', () => {
        it('should use AI to analyze contract data', async () => {
            vi.mocked(firebaseAI.analyzeImage).mockResolvedValue("Mocked AI analysis summary.");

            const args = {
                file_data: 'base64data',
                mime_type: 'application/pdf'
            };

            const result = await (LicensingAgent.functions!.analyze_contract as Function)(args);

            expect(firebaseAI.analyzeImage).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.data.summary).toBe("Mocked AI analysis summary.");
        });
    });

    describe('draft_license', () => {
        it('should use LegalTools to draft a contract', async () => {
            const { LegalTools } = await import('../tools/LegalTools');
            vi.mocked(LegalTools.draft_contract).mockResolvedValue({ success: true, data: { contract: "Mocked Contract Content" } });

            const args = {
                type: 'Sync License',
                parties: ['Artist', 'Label'],
                terms: 'Commercial use for 1 year'
            };

            const result = await (LicensingAgent.functions!.draft_license as Function)(args);

            expect(LegalTools.draft_contract).toHaveBeenCalledWith(args);
            expect(result.success).toBe(true);
            expect(result.data.contract).toBe("Mocked Contract Content");
        });
    });
});
