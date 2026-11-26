import type { IndiiVideoClip, IndiiVideoProject } from '@indii/shared';
import {
    judgeSocialAudioSnippetSelection,
    type SocialSnippetVerdict,
    type SongSectionMetadata,
} from '@/config/typesafeJudgments';
import { FreeMiniCampaignService } from '@/services/creative/FreeMiniCampaignService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface ShortFormHookCandidate {
    section: SongSectionMetadata['section'];
    startTimeSeconds: number;
    endTimeSeconds: number;
    durationSeconds: number;
    energyLevel: SongSectionMetadata['energyLevel'];
    lyricSnippet: string;
}

export interface ShortFormReelBuildInput {
    trackTitle: string;
    artistName: string;
    hook: ShortFormHookCandidate;
    hookAudioUrl: string;
    visualPrompt: string;
    style: string;
    aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9';
    hookHeadline?: string;
    ctaText?: string;
    accentColor?: string;
    firstFrameUrl?: string;
}

export interface ShortFormReelResult {
    project: IndiiVideoProject;
    videoUrl: string;
    canonicalVideoUri?: string;
    hookAudioUrl: string;
    hook: ShortFormHookCandidate;
}

const CANVAS_BY_ASPECT: Record<'9:16' | '1:1' | '4:5' | '16:9', { width: number; height: number }> = {
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
    '16:9': { width: 1920, height: 1080 },
};

/**
 * ShortFormReelService
 *
 * Bridges Gemini audio hook detection (`analyzeCampaignAudio`) and client/master
 * audio extraction (`FreeMiniCampaignService`) with Veo 3.1 visual generation and
 * deterministic HyperFrames (`IndiiVideoProject`) compilation so artists can turn
 * any track into a beat-framed, audio-synced short-form Reel/TikTok/Short.
 */
export class ShortFormReelService {
    /**
     * Analyzes an uploaded audio file via the authenticated `analyzeCampaignAudio`
     * Cloud Function and returns ranked 8–15s teaser hook windows.
     */
    static async detectHooks(file: File): Promise<{
        durationSeconds: number;
        hooks: ShortFormHookCandidate[];
        jevRecommendation?: SocialSnippetVerdict;
    }> {
        FreeMiniCampaignService.validateAudioFile(file);
        const uid = auth.currentUser?.uid;
        if (!uid) {
            throw new Error('Sign in to detect musical hooks for your short-form reel.');
        }

        const durationSeconds = await FreeMiniCampaignService.getAudioDuration(file);
        const candidates = await FreeMiniCampaignService.analyzeSongForHook(file, uid, durationSeconds);

        const hooks: ShortFormHookCandidate[] = candidates.map(candidate => {
            const start = Math.max(0, candidate.startTimeSeconds);
            const end = Math.min(durationSeconds, Math.max(start + 3, candidate.endTimeSeconds));
            return {
                section: candidate.section,
                startTimeSeconds: start,
                endTimeSeconds: end,
                durationSeconds: Math.round((end - start) * 100) / 100,
                energyLevel: candidate.energyLevel,
                lyricSnippet: candidate.lyricSnippet?.trim() ?? '',
            };
        });

        let jevRecommendation: SocialSnippetVerdict | undefined;
        if (hooks.length > 0) {
            jevRecommendation = await judgeSocialAudioSnippetSelection(candidates, 15);
            const recIdx = hooks.findIndex(
                h =>
                    h.section === jevRecommendation?.recommendedSection &&
                    Math.abs(h.startTimeSeconds - jevRecommendation.suggestedStartTimeSeconds) <= 2,
            );
            const fallbackSectionIdx = recIdx >= 0
                ? recIdx
                : hooks.findIndex(h => h.section === jevRecommendation?.recommendedSection);
            if (fallbackSectionIdx > 0) {
                const [picked] = hooks.splice(fallbackSectionIdx, 1);
                if (picked) hooks.unshift(picked);
            }
        }

        return { durationSeconds, hooks, jevRecommendation };
    }

    /**
     * Trims the selected hook window from the uploaded track into a clean WAV clip.
     */
    static async extractHookAudio(file: File, hook: ShortFormHookCandidate): Promise<{ url: string; durationSeconds: number }> {
        const clipDuration = Math.max(3, Math.min(30, hook.endTimeSeconds - hook.startTimeSeconds));
        return FreeMiniCampaignService.createAudioClip(file, hook.startTimeSeconds, clipDuration);
    }

    /**
     * Compiles a deterministic `IndiiVideoProject` combining generated footage,
     * safe-zone-aware kinetic hook typography, CTA end-card, and the trimmed song hook.
     */
    static buildHookReelProject(input: {
        trackTitle: string;
        artistName: string;
        hook: ShortFormHookCandidate;
        hookAudioUrl: string;
        videoUrl: string;
        canonicalVideoUri?: string;
        aspectRatio: '9:16' | '1:1' | '4:5' | '16:9';
        hookHeadline?: string;
        ctaText?: string;
        accentColor?: string;
    }): IndiiVideoProject {
        const fps = 30;
        const { width, height } = CANVAS_BY_ASPECT[input.aspectRatio];
        const totalSeconds = Math.max(6, Math.min(30, Math.round(input.hook.durationSeconds)));
        const durationInFrames = totalSeconds * fps;
        const accent = input.accentColor || '#FFE135';
        const isVertical = input.aspectRatio === '9:16';

        // Mobile safe-zone positioning (keeps text clear of TikTok/Reels right icons & bottom captions)
        const headlineY = isVertical ? Math.round(height * 0.18) : Math.round(height * 0.14);
        const ctaY = isVertical ? Math.round(height * 0.74) : Math.round(height * 0.80);
        const headlineFontSize = isVertical ? 68 : 56;
        const ctaFontSize = isVertical ? 36 : 32;

        const headlineText = (input.hookHeadline?.trim()
            || input.hook.lyricSnippet?.trim()
            || `${input.artistName} — ${input.trackTitle}`).slice(0, 90);
        const ctaText = (input.ctaText?.trim() || `Stream "${input.trackTitle}" now`).slice(0, 64);

        const clips: IndiiVideoClip[] = [
            {
                id: 'hook-reel-footage',
                type: 'video',
                src: input.videoUrl,
                ...(input.canonicalVideoUri ? { canonicalSourceUri: input.canonicalVideoUri } : {}),
                startFrame: 0,
                durationInFrames,
                trackId: 'video-main',
                name: `${input.trackTitle} Visual`,
                width,
                height,
                hasAudio: false,
            },
            {
                id: 'hook-reel-headline',
                type: 'text',
                text: headlineText,
                startFrame: 6, // Visible well within the critical 0–2s hook window
                durationInFrames: Math.min(durationInFrames - 6, Math.round(fps * 5.5)),
                trackId: 'overlay-text',
                name: '2s Hook Headline',
                x: Math.round(width * 0.08),
                y: headlineY,
                width: Math.round(width * 0.84),
                textColor: '#FFFFFF',
                fontSize: headlineFontSize,
                fontWeight: '900',
                textAlign: 'center',
                fontFamily: 'Archivo Black',
                textShadow: { color: 'rgba(0,0,0,0.75)', blur: 18, offsetX: 0, offsetY: 4 },
                entrance: { type: 'waterfall', staggerSeconds: 0.04 },
            },
            {
                id: 'hook-reel-cta',
                type: 'text',
                text: ctaText,
                startFrame: Math.max(fps * 2, durationInFrames - fps * 4),
                durationInFrames: Math.min(fps * 4, durationInFrames),
                trackId: 'overlay-cta',
                name: 'CTA End-Card',
                x: Math.round(width * 0.12),
                y: ctaY,
                width: Math.round(width * 0.76),
                textColor: '#0A0A0A',
                fontSize: ctaFontSize,
                fontWeight: '800',
                textAlign: 'center',
                fontFamily: 'Space Mono',
                textBackground: { color: accent, padding: 18, radius: 14 },
                transitionIn: { type: 'fade', duration: 10 },
            },
            {
                id: 'hook-reel-audio',
                type: 'audio',
                src: input.hookAudioUrl,
                startFrame: 0,
                durationInFrames,
                trackId: 'audio-hook',
                name: `${input.trackTitle} (${input.hook.section} Hook)`,
                volume: 1,
                audioFade: { inSeconds: 0.15, outSeconds: 0.5 },
            },
        ];

        return {
            id: `short_reel_${Date.now()}`,
            name: `${input.trackTitle} — ${input.aspectRatio} Hook Reel`,
            fps,
            durationInFrames,
            width,
            height,
            tracks: [
                { id: 'video-main', name: 'Footage', type: 'video' },
                { id: 'overlay-text', name: 'Hook Typography', type: 'text' },
                { id: 'overlay-cta', name: 'CTA Overlay', type: 'text' },
                { id: 'audio-hook', name: 'Hook Audio', type: 'audio' },
            ],
            clips,
        };
    }

    /**
     * Generates the underlying Veo 3.1 footage (9:16 for portrait/square/4:5 or 16:9 for landscape)
     * and returns the compiled, audio-synced `IndiiVideoProject` ready for HyperFrames preview/export.
     */
    static async generateHookReel(input: ShortFormReelBuildInput): Promise<ShortFormReelResult> {
        const aspectRatio = input.aspectRatio ?? '9:16';
        // Veo 3.1 natively supports 9:16 and 16:9; HyperFrames crops/frames 1:1 & 4:5 cleanly from 9:16
        const veoAspect: '9:16' | '16:9' = aspectRatio === '16:9' ? '16:9' : '9:16';

        const prompt = [
            `${input.style} short-form music promo visual for "${input.trackTitle}" by ${input.artistName}.`,
            `Section: ${input.hook.section} (${input.hook.energyLevel} energy).`,
            input.visualPrompt.trim(),
            'High-impact visual hook within the first 2 seconds. Clean composition with room for typography.',
        ].join(' ');

        const results = await VideoGeneration.generateVideo({
            prompt,
            aspectRatio: veoAspect,
            durationSeconds: 8,
            resolution: '1080p',
            ...(input.firstFrameUrl ? { firstFrame: input.firstFrameUrl } : {}),
        });

        const first = results[0];
        if (!first?.id) {
            throw new Error('Video generation did not return a valid job ID.');
        }

        let videoUrl = first.url;
        let canonicalVideoUri: string | undefined;
        if (!videoUrl) {
            const completed = await VideoGeneration.waitForJob(first.id);
            videoUrl = completed.videoUrl || completed.output?.url || completed.url || '';
            canonicalVideoUri = completed.resultUri?.startsWith('gs://') ? completed.resultUri : undefined;
        }

        if (!videoUrl) {
            throw new Error('Generated hook reel completed without a playable video URL.');
        }

        logger.info('[ShortFormReelService] Generated hook footage:', { aspectRatio, jobId: first.id });

        const project = this.buildHookReelProject({
            trackTitle: input.trackTitle,
            artistName: input.artistName,
            hook: input.hook,
            hookAudioUrl: input.hookAudioUrl,
            videoUrl,
            canonicalVideoUri,
            aspectRatio,
            hookHeadline: input.hookHeadline,
            ctaText: input.ctaText,
            accentColor: input.accentColor,
        });

        return {
            project,
            videoUrl,
            canonicalVideoUri,
            hookAudioUrl: input.hookAudioUrl,
            hook: input.hook,
        };
    }
}
