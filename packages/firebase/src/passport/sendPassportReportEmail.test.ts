// Structural-only trigger tests using service doubles; not delivery evidence.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildPassportReportContent, sendPassportReportEmail } from './sendPassportReportEmail';
import * as notify from '../lib/notify';

vi.mock('../lib/notify', () => ({
    resendApiKey: { value: vi.fn(() => 'test-resend-key') },
    sendTransactionalEmail: vi.fn(),
}));

describe('sendPassportReportEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('buildPassportReportContent', () => {
        it('builds subject, HTML and plain text with claim URL', () => {
            const content = buildPassportReportContent({
                assessmentId: 'test-uuid-123',
                artistName: 'Maya Sterling',
                email: 'maya@example.com',
                careerStage: 'Building momentum',
                genre: 'Electronic / Dance',
                proAffiliation: 'ASCAP',
                mlcRegistered: 'Yes',
                distributor: 'DistroKid',
                releaseStatus: 'Writing songs',
                goals: ['distribute_first_release'],
            });

            expect(content.subject).toBe('Your indii.music Artist Passport & Diagnostic Report');
            expect(content.html).toContain('Maya Sterling');
            expect(content.html).toContain('signup?assessmentId=test-uuid-123');
            expect(content.html).toContain('Electronic / Dance');
            expect(content.text).toContain('signup?assessmentId=test-uuid-123');
        });

        it('flags PRO and MLC gaps when missing in answers', () => {
            const content = buildPassportReportContent({
                assessmentId: 'test-uuid-456',
                artistName: 'Jordan Cole',
                email: 'jordan@example.com',
                careerStage: 'Just starting out',
                genre: 'Hip-Hop / Rap',
                proAffiliation: 'None',
                mlcRegistered: 'No',
                distributor: 'None',
                releaseStatus: 'Mixing or mastering',
                goals: [],
            });

            expect(content.html).toContain('Uncollected Performance Royalties');
            expect(content.html).toContain('Mechanical Royalty Gap');
            expect(content.html).toContain('Release Preparation Notice');
            expect(content.text).toContain('[Warning] Without a PRO');
            expect(content.text).toContain('[Warning] Interactive streaming mechanicals');
        });
    });

    describe('trigger handler logic', () => {
        it('delivers email and updates document when valid email exists and not previously sent', async () => {
            const mockUpdate = vi.fn().mockResolvedValue(undefined);
            const mockSend = vi.mocked(notify.sendTransactionalEmail).mockResolvedValue({
                sent: true,
                messageId: 'msg-abc-789',
            });

            const event = {
                params: { assessmentId: 'doc-999' },
                data: {
                    after: {
                        exists: true,
                        data: () => ({
                        assessmentConsent: true,
                            id: 'doc-999',
                            artistName: 'Elena Rostova',
                            email: 'elena@example.com',
                            careerStage: 'Established independent',
                            genre: 'Classical Crossover',
                            proAffiliation: 'BMI',
                            mlcRegistered: 'Yes',
                            distributor: 'TuneCore',
                            releaseStatus: 'Ready to release',
                            goals: ['advance_publishing'],
                        }),
                        ref: { update: mockUpdate },
                    },
                },
            };

            // Call handler directly (functions/v2 mock runs inner async callback)
            await (sendPassportReportEmail as unknown as (e: unknown) => Promise<void>)(event);

            expect(mockSend).toHaveBeenCalledWith(
                'elena@example.com',
                expect.stringContaining('Artist Passport'),
                expect.stringContaining('Elena Rostova'),
                expect.objectContaining({
                    idempotencyKey: 'passport-report-doc-999',
                })
            );

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportEmailMessageId: 'msg-abc-789',
                })
            );
        });

        it('is idempotent: skips email delivery if reportEmailSentAt is already present', async () => {
            const mockUpdate = vi.fn();
            const mockSend = vi.mocked(notify.sendTransactionalEmail);

            const event = {
                params: { assessmentId: 'doc-already-sent' },
                data: {
                    after: {
                        exists: true,
                        data: () => ({
                        assessmentConsent: true,
                            id: 'doc-already-sent',
                            email: 'elena@example.com',
                            reportEmailSentAt: 1728500000000,
                        }),
                        ref: { update: mockUpdate },
                    },
                },
            };

            await (sendPassportReportEmail as unknown as (e: unknown) => Promise<void>)(event);

            expect(mockSend).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('skips gracefully when email is absent or document deleted', async () => {
            const mockUpdate = vi.fn();
            const mockSend = vi.mocked(notify.sendTransactionalEmail);

            const deletedEvent = {
                params: { assessmentId: 'doc-deleted' },
                data: {
                    after: { exists: false },
                },
            };

            await (sendPassportReportEmail as unknown as (e: unknown) => Promise<void>)(deletedEvent);

            expect(mockSend).not.toHaveBeenCalled();

            const noEmailEvent = {
                params: { assessmentId: 'doc-no-email' },
                data: {
                    after: {
                        exists: true,
                        data: () => ({
                        assessmentConsent: true, id: 'doc-no-email' }),
                        ref: { update: mockUpdate },
                    },
                },
            };

            await (sendPassportReportEmail as unknown as (e: unknown) => Promise<void>)(noEmailEvent);

            expect(mockSend).not.toHaveBeenCalled();
        });
    });
});
