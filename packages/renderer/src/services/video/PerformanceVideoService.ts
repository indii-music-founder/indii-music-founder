import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@/services/firebase';
import { VideoGeneration } from './VideoGenerationService';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { logger } from '@/utils/logger';
import type { VideoProject, VideoClip, VideoTrack } from '@/modules/creative/video/store/videoEditorStore';
import type { VideoGenerationOptions } from '@/modules/creative/video/schemas';
import type { MasterAudioReference } from '@/services/metadata/types';

interface SonicProfile {
  bpm: number;
  key: string;
  mood: string;
  texture: string;
  instrumentation: string[];
  vocalPresence: boolean;
  intensity: number;
  genre: string;
  timestamp_markers?: Array<{ time: string; event: string }>;
}

export interface PerformanceVideoOptions {
  songUrl: string;
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
   *  4. Assemble Remotion project with clips on track 1 + song as Audio
   *  5. Render to video
   */
  async generate(opts: PerformanceVideoOptions): Promise<PerformanceVideoResult> {
    if (!auth.currentUser) {
      throw new Error('User must be authenticated to generate a performance video.');
    }

    try {
      logger.info('[PerformanceVideo] Starting generation with options:', opts);
      const masterAudioUrl = opts.masterAsset?.downloadUrl || opts.songUrl;
      const masterMimeType = opts.masterAsset?.mimeType || 'audio/mpeg';

      // Step 1: Analyze the song
      const sonicProfile = await this.analyzeSong(masterAudioUrl, masterMimeType);
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

      // Step 4: Build Remotion project
      const project = this.buildRemotionProject(
        sceneUrls,
        masterAudioUrl,
        scenes,
        opts.aspectRatio || '16:9',
        opts.masterAsset?.masterFingerprint,
        opts.isrc
      );
      logger.info('[PerformanceVideo] Built Remotion project:', {
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

  /**
   * Call analyzeAudio Cloud Fn to extract BPM, mood, structure, etc.
   */
  private async analyzeSong(songUrl: string, mimeType: string): Promise<SonicProfile> {
    const analyzeAudio = httpsCallable<
      { audioUrl: string; mimeType?: string },
      SonicProfile
    >(functions, 'analyzeAudio');

    const response = await analyzeAudio({ audioUrl: songUrl, mimeType });
    return response.data;
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
  ): Promise<Array<{ prompt: string; durationSec: number }>> {
    const bpm = profile.bpm || 120;
    const secondsPerBeat = 60 / bpm;
    const barsPerScene = 8;
    const sceneLength = barsPerScene * 4 * secondsPerBeat;

    const estimatedSongDuration = 180;
    const numScenes = sceneCount || Math.ceil(estimatedSongDuration / sceneLength);

    const scenes: Array<{ prompt: string; durationSec: number }> = [];
    for (let i = 0; i < numScenes; i++) {
      const moodPhrase = profile.mood || 'energetic';
      const stylePhrase = style || 'cinematic';
      const prompt = `Performance video scene ${i + 1}/${numScenes}. ${moodPhrase} ${stylePhrase} camera movement. Artist performing, dynamic lighting. No lyrics or talking.`;

      scenes.push({
        prompt,
        durationSec: sceneLength,
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
    scenes: Array<{ prompt: string; durationSec: number }>,
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
        durationSeconds: Math.ceil(scene.durationSec),
        aspectRatio: aspectRatio as '16:9' | '9:16',
      };

      const results = await this.videoGenService.generateVideo(options);

      if (!results || results.length === 0) {
        throw new Error('Failed to generate clip for scene.');
      }

      clips.push(results[0].url);
    }

    return clips;
  }

  /**
   * Build a Remotion VideoProject from scene clips and the original song.
   */
  private buildRemotionProject(
    sceneUrls: string[],
    songUrl: string,
    scenes: Array<{ prompt: string; durationSec: number }>,
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
      const fade = { type: 'fade' as const, duration: Math.max(6, fps / 2) };

      clips.push({
        id: `scene-${i}`,
        type: 'video',
        src: sceneUrls[i],
        startFrame,
        durationInFrames: durationFrames,
        trackId: 'video-1',
        name: `Scene ${i + 1}`,
        transitionIn: fade,
        transitionOut: fade,
      });

      startFrame += durationFrames;
      totalFrames += durationFrames;
    }

    clips.push({
      id: 'audio-original-song',
      type: 'audio',
      src: songUrl,
      startFrame: 0,
      durationInFrames: totalFrames,
      trackId: 'audio-1',
      name: 'Original Song',
      volume: 1,
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
   * Call the renderVideo Cloud Function to compose the Remotion project into an mp4.
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
