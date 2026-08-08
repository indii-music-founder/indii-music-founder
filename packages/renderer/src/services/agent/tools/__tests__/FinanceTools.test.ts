import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceTools } from '../FinanceTools';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getFineTunedModel } from '../../fine-tuned-models';
import { importWithRetry } from '@/utils/dynamicImport';

// Mock Dependencies
vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue('Mock analysis text'),
        generateContent: vi.fn().mockResolvedValue('Mock Intelligence response')
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/core/config/distributors', () => ({
    DISTRIBUTORS: {
        'distrokid': {
            name: 'DistroKid',
            systemIdentifier: 'PADPIDA2013021901W'
        },
        'tunecore': {
            name: 'TuneCore',
            systemIdentifier: 'PADPIDA2009090203U'
        }
    }
}));

describe('FinanceTools', () => {
    let AutonomousIntelligence: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
        AutonomousIntelligence = module.AutonomousIntelligence;
    });

    describe('analyze_receipt', () => {
        it('should successfully analyze a receipt and return parsed data', async () => {
            const mockResponseText = JSON.stringify({
                vendor: 'Office Depot',
                date: '2023-10-27',
                amount: 45.99,
                category: 'Equipment',
                description: 'Printer Paper'
            });

            AutonomousIntelligence.generateContent.mockResolvedValue({
                response: {
                    text: () => mockResponseText
                }
            });

            const args = {
                image_data: 'base64encodedimage...',
                mime_type: 'image/jpeg'
            };

            const result = await FinanceTools.analyze_receipt(args);

            expect(AutonomousIntelligence.generateContent).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'user',
                        parts: expect.arrayContaining([
                            expect.objectContaining({ inlineData: { mimeType: args.mime_type, data: args.image_data } })
                        ])
                    })
                ]),
                expect.any(String)
            );

            expect(result).toEqual(expect.objectContaining({
                success: true,
                data: {
                    raw_data: mockResponseText,
                    message: 'Receipt analysis completed.'
                }
            }));
        });

        it('should handle Autonomous errors gracefully via wrapTool', async () => {
            AutonomousIntelligence.generateContent.mockRejectedValue(new Error('AI Error'));

            const args = {
                image_data: 'data',
                mime_type: 'image/png'
            };

            const result = await FinanceTools.analyze_receipt(args);

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI Error');
            expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
        });
    });

    describe('audit_distribution', () => {
        it('should return success for a valid distributor (Happy Path)', async () => {
            const args = {
                trackTitle: 'My Song',
                distributor: 'distrokid'
            };

            const result = await FinanceTools.audit_distribution(args);

            expect(result).toEqual(expect.objectContaining({
                success: true,
                data: {
                    status: 'READY_FOR_AUDIT',
                    distributor: 'DistroKid',
                    party_id: 'PADPIDA2013021901W',
                    message: expect.stringContaining("Distribution channel 'DistroKid' verified")
                }
            }));
        });

        it('should return failure for an invalid distributor (Input Sanitizer)', async () => {
            const args = {
                trackTitle: 'My Song',
                distributor: 'unknown_distributor'
            };

            const result = await FinanceTools.audit_distribution(args);

            expect(result).toEqual(expect.objectContaining({
                success: false,
                error: "Distributor 'unknown_distributor' is not in the approved database.",
                metadata: expect.objectContaining({
                    errorCode: 'UNKNOWN_DISTRIBUTOR'
                })
            }));
        });
    });

    describe('forecast_revenue', () => {
        it('should calculate revenue and savings correctly for Spotify', async () => {
            const result = await FinanceTools.forecast_revenue({
                currentStreams: 1000000,
                platform: 'Spotify',
                rightsHolderSplit: 100 // 100% to rights holder
            });

            expect(result.success).toBe(true);

            // 1,000,000 * 0.004 = 4000
            expect(result.data.projections.gross.month_1).toBeCloseTo(4000);

            // 20% of 4000 = 800
            expect(result.data.projections.manager_fee_saved.month_1).toBeCloseTo(800);

            // Net = 4000
            expect(result.data.projections.net_to_rights_holder.month_1).toBeCloseTo(4000);

            expect(result.data.message).toContain('Rough revenue estimate');
            expect(result.data.estimateType).toBe('rough_estimate');
            expect(result.data.confidenceLevel).toBe('low');
            expect(result.data.confidenceSource).toContain('No distributor statement history');
            expect(result.data.assumptions).toContain('The manager-fee comparison is hypothetical at 20%; it is not verified money saved.');
        });

        it('rejects impossible stream and rights-split inputs', async () => {
            await expect(FinanceTools.forecast_revenue({
                currentStreams: -1,
                platform: 'Spotify',
                rightsHolderSplit: 100,
            })).resolves.toEqual(expect.objectContaining({ success: false }));
            await expect(FinanceTools.forecast_revenue({
                currentStreams: 100,
                platform: 'Spotify',
                rightsHolderSplit: 101,
            })).resolves.toEqual(expect.objectContaining({ success: false }));
        });

        it('should handle split percentages correctly', async () => {
            const result = await FinanceTools.forecast_revenue({
                currentStreams: 10000,
                platform: 'Other', // rate 0.003 -> $30
                rightsHolderSplit: 50
            });

            expect(result.success).toBe(true);
            expect(result.data.projections.gross.month_1).toBeCloseTo(30);
            expect(result.data.projections.net_to_rights_holder.month_1).toBeCloseTo(15);
        });
    });

    /**
     * ISSUE-856: this tool never parses CSV content, validates columns, or
     * reconciles totals — it only asks Gemini to describe a mapping
     * conceptually, yet used to report status: 'Normalized into standard
     * indii ledger format'. These prove the output is now honestly labeled
     * a draft suggestion, not completed ledger normalization.
     */
    describe('normalize_distributor_statements (ISSUE-856)', () => {
        it('labels the output mapping_draft, not a completed normalization', async () => {
            AutonomousIntelligence.generateContent.mockResolvedValue({
                response: {
                    text: () => JSON.stringify({ mapping: 'track_title,artist,isrc,period,streams,revenue,territory,distributor' })
                }
            });

            const result = await FinanceTools.normalize_distributor_statements({
                csvFiles: ['distrokid_2026_06.csv', 'tunecore_2026_06.csv'],
            });

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('mapping_draft');
            expect(result.data.status).not.toBe('Normalized into standard indii ledger format');
            expect(result.message).toContain('No files were actually parsed');
            expect(result.message).toContain('draft normalization mapping');
        });
    });
});
