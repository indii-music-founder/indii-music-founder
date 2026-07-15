
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicistTools } from '../PublicistTools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { addDoc } from 'firebase/firestore';
// Mock Firebase AI
vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

describe('PublicistTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('write_press_release returns valid schema', async () => {
        const mockResponse = {
            headline: 'New Release',
            dateline: 'NEW YORK, Jan 2026',
            introduction: 'Intro',
            body_paragraphs: ['Para 1'],
            quotes: [{ speaker: 'Artist', text: 'Stoked' }],
            boilerplate: 'About us',
            contact_info: { name: 'PR', email: 'pr@example.com' },
            pdf: null
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.write_press_release({ topic: 'New Album' });

        expect(result.success).toBe(true);
        // ISSUE-838: the tool now reports real saved/docId state instead of
        // an unconditional "saved" claim — the shared test setup's Firebase
        // mock has a signed-in user and a resolving addDoc, so this is the
        // real-write-succeeded path.
        expect(result.data).toEqual({ ...mockResponse, saved: true, docId: 'mock-doc-id' });
        expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
    });

    it('draft_pitch_email returns valid schema', async () => {
        const mockResponse = {
            subject_line: 'Playlist Pitch',
            hook: 'Hook',
            body: 'Body',
            call_to_action: 'CTA',
            angle: 'Angle',
            target_outlets: ['Spotify Playlist']
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.draft_pitch_email({ playlistName: 'RapCaviar', genre: 'Hip Hop', trackTitle: 'Hot Track' });

        expect(result.success).toBe(true);
        // draft_pitch_email honestly flags its output as a template (real
        // personalization needs a Spotify API connection), so isTemplate is
        // part of the contract.
        expect(result.data).toEqual({ ...mockResponse, saved: true, docId: 'mock-doc-id', isTemplate: true });
    });

    it('generate_crisis_response returns valid schema', async () => {
        const mockResponse = {
            severity_assessment: 'MEDIUM',
            strategy: 'Apologize',
            public_statement: 'Sorry',
            internal_talking_points: ['Point 1'],
            actions_to_take: ['Action 1']
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.generate_crisis_response({ situation: 'Leak' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ ...mockResponse, saved: true, docId: 'mock-doc-id' });
    });

    it('pitch_story returns valid schema', async () => {
        const mockResponse = {
            subject_line: 'Pitch',
            hook: 'Hook',
            body: 'Body',
            call_to_action: 'CTA',
            angle: 'Angle',
            target_outlets: ['Outlet 1']
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.pitch_story({ story_summary: 'We cool', recipient_type: 'blog' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ ...mockResponse, saved: true, docId: 'mock-doc-id' });
    });

    /**
     * ISSUE-838: these tools used to claim "saved"/"created and saved" even
     * when no user was signed in or the Firestore write failed. These prove
     * the response now honestly reports saved: false with the real reason.
     */
    it('write_press_release reports saved: false when no user is signed in', async () => {
        const { auth } = await import('@/services/firebase');
        const originalUser = auth.currentUser;
        (auth as { currentUser: unknown }).currentUser = null;

        const mockResponse = {
            headline: 'New Release',
            dateline: 'NEW YORK, Jan 2026',
            introduction: 'Intro',
            body_paragraphs: ['Para 1'],
            quotes: [{ speaker: 'Artist', text: 'Stoked' }],
            boilerplate: 'About us',
            contact_info: { name: 'PR', email: 'pr@example.com' },
            pdf: null
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        try {
            const result = await PublicistTools.write_press_release({ topic: 'New Album' });

            expect(result.success).toBe(true);
            expect(result.data.saved).toBe(false);
            expect(result.data.docId).toBeUndefined();
            expect(result.message).toContain('NOT saved');
            expect(result.message).toContain('No user is signed in');
        } finally {
            (auth as { currentUser: unknown }).currentUser = originalUser;
        }
    });

    it('pitch_story reports saved: false with the real error when the Firestore write fails', async () => {
        vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore unavailable'));
        const mockResponse = {
            subject_line: 'Pitch',
            hook: 'Hook',
            body: 'Body',
            call_to_action: 'CTA',
            angle: 'Angle',
            target_outlets: ['Outlet 1']
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.pitch_story({ story_summary: 'We cool', recipient_type: 'blog' });

        expect(result.success).toBe(true);
        expect(result.data.saved).toBe(false);
        expect(result.data.docId).toBeUndefined();
        expect(result.message).toContain('NOT saved');
        expect(result.message).toContain('Firestore unavailable');
    });

    it('handles Autonomous failure gracefully', async () => {
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockRejectedValue(new Error("AI Down"));
        const result = await PublicistTools.write_press_release({ topic: 'Fail' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('AI Down');
    });
});
