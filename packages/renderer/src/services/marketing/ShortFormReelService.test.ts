import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAnalyzeSongForHook = vi.fn();
const mockValidateAudioFile = vi.fn();
const mockGetAudioDuration = vi.fn();
const mockCreateAudioClip = vi.fn();
const mockGenerateVideo = vi.fn();
const mockWaitForJob = vi.fn();
const mockJudgeSocialAudioSnippetSelection = vi.fn();

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'artist_uid_1' } },
}));

vi.mock('@/config/typesafeJudgments', () => ({
    judgeSocialAudioSnippetSelection: (...args: unknown[]) => mockJudgeSocialAudioSnippetSelection(...args),
}));

vi.mock('@/services/creative/FreeMiniCampaignService', () => ({
    FreeMiniCampaignService: {
        validateAudioFile: (...args: unknown[]) => mockValidateAudioFile(...args),
        getAudioDuration: (...args: unknown[]) => mockGetAudioDuration(...args),
        analyzeSongForHook: (...args: unknown[]) => mockAnalyzeSongForHook(...args),
        createAudioClip: (...args: unknown[]) => mockCreateAudioClip(...args),
    },
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: unknown[]) => mockGenerateVideo(...args),
        waitForJob: (...args: unknown[]) => mockWaitForJob(...args),
    },
}));

import { ShortFormReelService } from '@/services/marketing/ShortFormReelService';

describe('ShortFormReelService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAudioDuration.mockResolvedValue(195);
        mockAnalyzeSongForHook.mockResolvedValue([
            {
                section: 'VERSE',
                startTimeSeconds: 12,
                endTimeSeconds: 27,
                energyLevel: 'moderate',
                lyricSnippet: 'Walking down the empty street',
            },
            {
                section: 'CHORUS',
                startTimeSeconds: 42.5,
                endTimeSeconds: 57.5,
                energyLevel: 'peak',
                lyricSnippet: 'Lights up on the midnight avenue',
            },
        ]);
        mockJudgeSocialAudioSnippetSelection.mockResolvedValue({
            recommendedSection: 'CHORUS',
            suggestedStartTimeSeconds: 42.5,
            suggestedEndTimeSeconds: 57.5,
            viralHookPotential: 5,
            isImmediateVocalOnset: true,
            hookStrategy: 'Jev picked CHORUS for peak viral onset.',
        });
        mockGenerateVideo.mockResolvedValue([{ id: 'job_reel_1', url: '' }]);
        mockWaitForJob.mockResolvedValue({
            status: 'completed',
            videoUrl: 'https://storage.googleapis.com/bucket/reel_1.mp4',
            resultUri: 'gs://bucket/reel_1.mp4',
        });
    });

    it('detects song hook windows via analyzeCampaignAudio and promotes Jev recommendation first', async () => {
        const fakeFile = new File(['audio'], 'midnight.wav', { type: 'audio/wav' });
        const result = await ShortFormReelService.detectHooks(fakeFile);

        expect(result.durationSeconds).toBe(195);
        expect(result.hooks).toHaveLength(2);
        expect(result.hooks[0]).toMatchObject({
            section: 'CHORUS',
            startTimeSeconds: 42.5,
            endTimeSeconds: 57.5,
            durationSeconds: 15,
            energyLevel: 'peak',
        });
        expect(result.jevRecommendation?.recommendedSection).toBe('CHORUS');
    });

    it('compiles a safe-zone-aware 9:16 hook reel project with 2s headline, CTA, and hook audio', async () => {
        const result = await ShortFormReelService.generateHookReel({
            trackTitle: 'Midnight Avenue',
            artistName: 'Nova',
            hook: {
                section: 'CHORUS',
                startTimeSeconds: 42.5,
                endTimeSeconds: 57.5,
                durationSeconds: 15,
                energyLevel: 'peak',
                lyricSnippet: 'Lights up on the midnight avenue',
            },
            hookAudioUrl: 'blob:hook-audio-1',
            visualPrompt: 'Neon rain reflection on wet asphalt, slow push-in',
            style: 'cinematic',
            aspectRatio: '9:16',
        });

        expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
            aspectRatio: '9:16',
            durationSeconds: 8,
            resolution: '1080p',
        }));
        expect(result.project.width).toBe(1080);
        expect(result.project.height).toBe(1920);
        expect(result.project.clips).toHaveLength(4);
        const headline = result.project.clips.find(c => c.id === 'hook-reel-headline');
        const audio = result.project.clips.find(c => c.id === 'hook-reel-audio');
        expect(headline?.startFrame).toBeLessThan(60); // Within first 2s
        expect(audio?.src).toBe('blob:hook-audio-1');
    });
});
