import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@/services/firebase';
import { audioAnalysisReceiptService, type AudioAnalysisReceipt } from '@/services/audio/AudioAnalysisReceiptService';
import { VideoGeneration } from './VideoGenerationService';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { logger } from '@/utils/logger';
import type { CanonicalMasterRenderReference, VideoProject, VideoClip, VideoTrack } from '@/modules/creative/video/store/videoEditorStore';
import type { VideoGenerationOptions } from '@/modules/creative/video/schemas';
import type { MasterAudioReference } from '@/services/metadata/types';

export interface SonicProfile {
  bpm: number;
  mood: string;
  durationSeconds: number;
  beatTimestampsSec: number[];
}

interface PerformanceScene {
  prompt: string;
  /** Exact amount of the canonical master covered by this timeline slot. */
  durationSec: number;
  /** Legal Veo request duration; the final segment may be trimmed by the master mix. */
  generationDurationSec: 4 | 6 | 8;
}

export interface PerformanceVideoOptions {
  masterAsset?: MasterAudioReference;
  isrc?: string;
  artistImageUrl?: string;
  artistDescription?: string;
  style?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  sceneCount?: number;
}

interface PerformanceVideoResult {
  videoUrl: string;
  projectId?: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function firstText(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const candidate = value.find(item => typeof item === 'string' && item.trim());
  return typeof candidate === 'string' ? candidate.trim() : undefined;
}

/** Convert the one durable server receipt into the minimum beat-planning input. */
export function sonicProfileFromAnalysisReceipt(receipt: AudioAnalysisReceipt): SonicProfile {
  if (receipt.status !== 'complete') {
    throw new Error('Canonical-master analysis is not complete.');
  }
  const openSource = record(receipt.openSourceProfile);
  const gemini = record(receipt.geminiProfile);
  const bpm = Number(openSource?.tempoBpm);
  const durationSeconds = Number(receipt.technical?.durationSeconds);
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new Error('Canonical-master receipt does not contain a measured BPM.');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Canonical-master receipt does not contain a measured duration.');
  }
  const beatTimestampsSec = Array.isArray(openSource?.beatTimestampsSec)
    ? openSource.beatTimestampsSec
        .map(Number)
        .filter(timestamp => Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= durationSeconds)
        .sort((left, right) => left - right)
    : [];
  return {
    bpm,
    mood: firstText(gemini?.moods) ?? 'undetermined',
    durationSeconds,
    beatTimestampsSec,
  };
}

function requireCanonicalMaster(
  master: MasterAudioReference | undefined,
  ownerUid: string,
): MasterAudioReference & { generation: string } {
  if (!master) {
    throw new Error('A verified canonical master is required to generate a performance video.');
  }
  const pattern = new RegExp(`^masters/${ownerUid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([a-f0-9]{64})/original\\.(wav|flac)$`);
  const match = master.storagePath.match(pattern);
  if (!match || match[1] !== master.contentHash || !master.generation || !master.downloadUrl) {
    throw new Error('A generation-bound canonical master is required to generate a performance video.');
  }
  return master as MasterAudioReference & { generation: string };
}

/**
 * PerformanceVideoService orchestrates the creation of beat-synced performance videos
 * from an artist's uploaded song + AI-generated or provided performer imagery.
 *
 * Shared orchestrator for both agent tool and node handlers (DRY).
 */
export class PerformanceVideoService {
  private videoGenService = VideoGeneration;
  private imageGenService = ImageGeneration;

  /**
   * Generate a beat-synced performance music video.
   * Steps:
   *  1. Analyze the song (BPM, duration, structure)
   *  2. Mint or use artist image
   *  3. Generate performance clips per scene (beat-aligned)
   *  4. Assemble timeline project with clips on track 1 + song as Audio
   *  5. Render to video
   */
  async generate(opts: PerformanceVideoOptions): Promise<PerformanceVideoResult> {
    if (!auth.currentUser) {
      throw new Error('User must be authenticated to generate a performance video.');
    }

    try {
      const masterAsset = requireCanonicalMaster(opts.masterAsset, auth.currentUser.uid);
      logger.info('[PerformanceVideo] Starting generation from canonical master:', {
        contentHash: masterAsset.contentHash,
        generation: masterAsset.generation,
        storagePath: masterAsset.storagePath,
      });
      // Step 1: Reuse the protected server analysis; do not submit this master again.
      const sonicProfile = await this.analyzeSong(masterAsset, auth.currentUser.uid);
      logger.info('[PerformanceVideo] Song analysis:', {
        bpm: sonicProfile.bpm,
        mood: sonicProfile.mood,
      });

      // Step 2: Ensure artist image
      let artistImageUrl = opts.artistImageUrl;
      if (!artistImageUrl) {
        if (!opts.artistDescription) {
          throw new Error('Artist image or description is required.');
        }
        artistImageUrl = await this.generateArtistImage(opts.artistDescription, opts.style);
        logger.info('[PerformanceVideo] Generated artist image:', artistImageUrl);
      }

      // Step 3: Plan scenes and generate clips
      const scenes = await this.planScenes(
        sonicProfile,
        opts.sceneCount,
        opts.style || 'cinematic performance'
      );
      logger.info('[PerformanceVideo] Planned', scenes.length, 'scenes');

      const sceneUrls = await this.generateSceneClips(
        artistImageUrl,
        scenes,
        opts.aspectRatio || '16:9'
      );
      logger.info('[PerformanceVideo] Generated', sceneUrls.length, 'scene clips');

      // Step 4: Build timeline project
      const project = this.buildTimelineProject(
        sceneUrls,
        masterAsset,
        scenes,
        opts.aspectRatio || '16:9',
        masterAsset.masterFingerprint,
        opts.isrc
      );
      logger.info('[PerformanceVideo] Built timeline project:', {
        durationInFrames: project.durationInFrames,
        fps: project.fps,
        clipCount: project.clips.length,
      });

      // Step 5: Render to video
      const videoUrl = await this.renderVideo(project);
      logger.info('[PerformanceVideo] Rendered video:', videoUrl);

      return { videoUrl, projectId: project.id };
    } catch (err) {
      logger.error('[PerformanceVideo] Generation failed:', err);
      throw err;
    }
  }

  /** Reuses the generation-bound receipt created by the canonical DSP worker. */
  private async analyzeSong(masterAsset: MasterAudioReference, ownerUid: string): Promise<SonicProfile> {
    return sonicProfileFromAnalysisReceipt(
      await audioAnalysisReceiptService.waitForTerminalReceipt(masterAsset, ownerUid)
    );
  }

  /**
   * Generate a single AI artist image using Nano Banana Pro (consistent across scenes).
   */
  private async generateArtistImage(description: string, style?: string): Promise<string> {
    const stylePhrase = style || 'cinematic, performing, dynamic, professional';
    const prompt = `${description}. ${stylePhrase}. Full body, stage lighting.`;

    const results = await this.imageGenService.generateImages({
      prompt,
      count: 1,
      aspectRatio: '9:16',
      model: 'pro',
    });

    if (!results || results.length === 0) {
      throw new Error('Failed to generate artist image.');
    }

    return results[0].url;
  }

  /**
   * Plan scenes: split song into N beat-aligned sections.
   * Default: 8 bars per scene at the song's BPM.
   */
  private async planScenes(
    profile: SonicProfile,
    sceneCount?: number,
    style?: string
  ): Promise<PerformanceScene[]> {
    const bpm = profile.bpm || 120;
    const maximumSceneSeconds = 8;
    const minimumSceneCount = Math.ceil(profile.durationSeconds / maximumSceneSeconds);
    // The cloud stitcher concatenates provider outputs. Keep every non-final
    // clip at its physical eight-second duration so only the last clip needs a
    // trim; otherwise equal fractional splits accumulate A/V drift.
    const numScenes = minimumSceneCount;
    if (sceneCount && sceneCount !== minimumSceneCount) {
      logger.warn(
        `[PerformanceVideo] Ignoring requested scene count ${sceneCount}; ` +
        `${minimumSceneCount} provider-aligned scenes are required for the master duration.`,
      );
    }

    const scenes: PerformanceScene[] = [];
    for (let i = 0; i < numScenes; i++) {
      const moodPhrase = profile.mood === 'undetermined' ? 'musically aligned' : profile.mood;
      const stylePhrase = style || 'cinematic';
      const prompt = `Performance video scene ${i + 1}/${numScenes}. ${moodPhrase} ${stylePhrase} camera movement. Artist performing, dynamic lighting. No lyrics or talking.`;

      const startSeconds = i * maximumSceneSeconds;
      const endSeconds = Math.min(profile.durationSeconds, startSeconds + maximumSceneSeconds);
      const durationSec = endSeconds - startSeconds;
      const generationDurationSec: 4 | 6 | 8 = durationSec <= 4 ? 4 : durationSec <= 6 ? 6 : 8;
      scenes.push({
        prompt: `${prompt} Cover master time ${startSeconds.toFixed(3)}s–${endSeconds.toFixed(3)}s at ${bpm.toFixed(2)} BPM.`,
        durationSec,
        generationDurationSec,
      });
    }

    return scenes;
  }

  /**
   * Generate performance video clips for each scene using Veo 3.1 image-to-video.
   * Uses the artist image as firstFrame + referenceImages for consistency.
   */
  private async generateSceneClips(
    artistImageUrl: string,
    scenes: PerformanceScene[],
    aspectRatio: '9:16' | '16:9' | '1:1'
  ): Promise<string[]> {
    const clips: string[] = [];

    for (const scene of scenes) {
      const options: VideoGenerationOptions = {
        prompt: scene.prompt,
        firstFrame: artistImageUrl,
        referenceImages: [
          {
            image: { uri: artistImageUrl },
            referenceType: 'asset',
          },
        ],
        durationSeconds: scene.generationDurationSec,
        aspectRatio: aspectRatio as '16:9' | '9:16',
      };

      const results = await this.videoGenService.generateVideo(options);
      const jobId = results[0]?.id;
      if (!jobId) {
        throw new Error('Failed to queue a generated scene.');
      }

      const completedScene = await this.videoGenService.waitForJob(jobId);
      const resultUri = completedScene.resultUri;
      if (typeof resultUri !== 'string' || !resultUri.startsWith('gs://')) {
        throw new Error('Generated scene did not provide a server-owned Cloud Storage URI.');
      }
      clips.push(resultUri);
    }

    return clips;
  }

  /**
   * Build an IndiiVideoProject from scene clips and the original song.
   */
  private buildTimelineProject(
    sceneUrls: string[],
    masterAsset: MasterAudioReference,
    scenes: PerformanceScene[],
    aspectRatio: '9:16' | '16:9' | '1:1',
    masterFingerprint?: string,
    isrc?: string
  ): VideoProject {
    const fps = 30;
    const aspectRatios: Record<string, { width: number; height: number }> = {
      '9:16': { width: 1080, height: 1920 },
      '16:9': { width: 1920, height: 1080 },
      '1:1': { width: 1080, height: 1080 },
    };

    const dimensions = aspectRatios[aspectRatio] || aspectRatios['16:9'];

    let totalFrames = 0;
    const clips: VideoClip[] = [];
    let startFrame = 0;

    for (let i = 0; i < sceneUrls.length; i++) {
      const durationFrames = Math.round(scenes[i].durationSec * fps);
      clips.push({
        id: `scene-${i}`,
        type: 'video',
        src: sceneUrls[i],
        canonicalSourceUri: sceneUrls[i],
        startFrame,
        durationInFrames: durationFrames,
        trackId: 'video-1',
        name: `Scene ${i + 1}`,
      });

      startFrame += durationFrames;
      totalFrames += durationFrames;
    }

    clips.push({
      id: 'audio-original-song',
      type: 'audio',
      // Preview uses this signed URL locally. Firebase ignores it when it queues
      // the render and resolves canonicalMaster from Storage itself.
      src: masterAsset.downloadUrl,
      startFrame: 0,
      durationInFrames: totalFrames,
      trackId: 'audio-1',
      name: 'Original Song',
      volume: 1,
      canonicalMaster: {
        storagePath: masterAsset.storagePath,
        contentHash: masterAsset.contentHash,
        generation: masterAsset.generation,
        masterFingerprint: masterAsset.masterFingerprint,
        volume: 1,
      } satisfies CanonicalMasterRenderReference,
      ...(masterFingerprint ? { masterFingerprint } : {}),
      ...(isrc ? { isrc } : {}),
    });

    const tracks: VideoTrack[] = [
      { id: 'video-1', name: 'Performance', type: 'video' },
      { id: 'audio-1', name: 'Audio', type: 'audio' },
    ];

    return {
      id: `perf-video-${Date.now()}`,
      name: 'Performance Video',
      fps,
      durationInFrames: totalFrames,
      width: dimensions.width,
      height: dimensions.height,
      tracks,
      clips,
    };
  }

  /**
   * Call the renderVideo Cloud Function to compose the timeline project into an mp4.
   *
   * ISSUE-994 fix: the callable requires `{ compositionId, inputProps: { project } }`
   * (a bare `{ project }` fails its own `inputProps.project` validation) and only
   * queues an Inngest stitch job — it returns `{ success, renderId, message }`,
   * never a `videoUrl`. The actual asset only exists once the `videoJobs/{renderId}`
   * doc reaches a terminal status, so this now polls via the same `waitForJob()`
   * used by every other video job in this codebase (VideoTools' generate_video/
   * generate_video_chain) instead of reading a field the callable never returns.
   */
  private async renderVideo(project: VideoProject): Promise<string> {
    const renderVideo = httpsCallable<
      { compositionId: string; inputProps: { project: VideoProject } },
      { success: boolean; renderId: string; message: string }
    >(functions, 'renderVideo');

    const response = await renderVideo({ compositionId: project.id, inputProps: { project } });
    if (!response.data.renderId) {
      throw new Error(response.data.message || 'Render job could not be queued.');
    }

    const completedJob = await this.videoGenService.waitForJob(response.data.renderId);
    const videoUrl = completedJob.output?.url || completedJob.videoUrl || completedJob.url;
    if (!videoUrl) {
      throw new Error('Render completed without a video URL.');
    }
    return videoUrl;
  }
}

export const performanceVideoService = new PerformanceVideoService();
