import type {
  IndiiVideoProject,
  IndiiVideoClip,
  IndiiVideoTrack,
  TimelineAST,
  VideoClip,
  AudioClip,
  NLETrack,
  Transform2D,
} from '@indii/shared';

export const DEFAULT_NLE_TIMEBASE = 60000;

/**
 * Translates the high-level IndiiVideoProject into an immutable TimelineAST
 * with exact integer PTS rational time coordinates (Issue #413).
 */
export function projectToTimelineAST(
  project: IndiiVideoProject,
  timebase = DEFAULT_NLE_TIMEBASE
): TimelineAST {
  const fps = project.fps > 0 ? project.fps : 30;

  const tracks: NLETrack[] = project.tracks.map((track, trackIndex) => {
    const isAudio = track.type === 'audio';
    const trackClips = project.clips.filter((c) => c.trackId === track.id);

    const convertedClips: (VideoClip | AudioClip)[] = trackClips.map((clip) => {
      const startPts = BigInt(Math.round((clip.startFrame * timebase) / fps));
      const durationPts = BigInt(
        Math.max(1, Math.round((clip.durationInFrames * timebase) / fps))
      );

      const timelineRange = {
        start: { pts: startPts, timescale: timebase },
        duration: { pts: durationPts, timescale: timebase },
      };

      const sourceRange = {
        start: { pts: 0n, timescale: timebase },
        duration: { pts: durationPts, timescale: timebase },
      };

      const speed = clip.playbackRate && clip.playbackRate > 0 ? clip.playbackRate : 1.0;

      if (isAudio || clip.type === 'audio') {
        const audioClip: AudioClip = {
          id: clip.id,
          assetId: clip.src || clip.canonicalMaster?.storagePath || clip.id,
          type: 'audio',
          timelineRange,
          sourceRange,
          speed,
          gain: typeof clip.volume === 'number' ? clip.volume : 1.0,
          pan: 0,
          busAssignment: 'master',
        };
        return audioClip;
      }

      const transform: Transform2D = {
        position: { x: clip.x ?? 0, y: clip.y ?? 0 },
        scale: {
          x: clip.scale ?? (clip.width && project.width ? clip.width / project.width : 1),
          y: clip.scale ?? (clip.height && project.height ? clip.height / project.height : 1),
        },
        rotation: clip.rotation ?? 0,
        opacity: clip.opacity ?? 1.0,
        origin: { x: clip.anchorX ?? 0.5, y: clip.anchorY ?? 0.5 },
      };

      const videoClip: VideoClip = {
        id: clip.id,
        assetId: clip.src || clip.id,
        type: 'video',
        timelineRange,
        sourceRange,
        speed,
        transform,
        blendMode: 'normal',
        filters: [],
      };
      return videoClip;
    });

    return {
      id: track.id,
      type: isAudio ? 'audio' : 'video',
      index: trackIndex,
      muted: Boolean(track.isMuted),
      locked: Boolean(track.isLocked),
      clips: convertedClips,
    };
  });

  return {
    version: 1,
    id: project.id,
    timebase,
    dimensions: {
      width: project.width,
      height: project.height,
    },
    audioFormat: {
      sampleRate: 48000,
      channels: 2,
    },
    tracks,
  };
}

/**
 * Reconstructs an IndiiVideoProject from a TimelineAST (e.g. after headless manipulation or import).
 */
export function timelineASTToProject(
  ast: TimelineAST,
  targetFps = 60
): IndiiVideoProject {
  const fps = targetFps > 0 ? targetFps : 60;

  const tracks: IndiiVideoTrack[] = ast.tracks.map((track) => ({
    id: track.id,
    type: track.type === 'audio' ? 'audio' : 'video',
    name: track.type === 'audio' ? 'Audio Track' : 'Video Track',
    isMuted: track.muted,
    isLocked: track.locked,
  }));

  const clips: IndiiVideoClip[] = [];
  let maxEndFrame = 0;

  for (const track of ast.tracks) {
    for (const clip of track.clips) {
      const startSec = Number(clip.timelineRange.start.pts) / clip.timelineRange.start.timescale;
      const durSec = Number(clip.timelineRange.duration.pts) / clip.timelineRange.duration.timescale;

      const startFrame = Math.round(startSec * fps);
      const durationInFrames = Math.max(1, Math.round(durSec * fps));
      const endFrame = startFrame + durationInFrames;
      if (endFrame > maxEndFrame) {
        maxEndFrame = endFrame;
      }

      if (clip.type === 'video') {
        const vClip = clip as VideoClip;
        clips.push({
          id: vClip.id,
          name: `Clip ${vClip.id}`,
          type: 'video',
          src: vClip.assetId,
          startFrame,
          durationInFrames,
          trackId: track.id,
          x: vClip.transform.position.x,
          y: vClip.transform.position.y,
          scale: vClip.transform.scale.x,
          rotation: vClip.transform.rotation,
          opacity: vClip.transform.opacity,
          anchorX: vClip.transform.origin.x,
          anchorY: vClip.transform.origin.y,
          playbackRate: vClip.speed,
        });
      } else {
        const aClip = clip as AudioClip;
        clips.push({
          id: aClip.id,
          name: `Audio ${aClip.id}`,
          type: 'audio',
          src: aClip.assetId,
          startFrame,
          durationInFrames,
          trackId: track.id,
          volume: aClip.gain,
          playbackRate: aClip.speed,
        });
      }
    }
  }

  return {
    id: ast.id,
    name: `Project ${ast.id}`,
    fps,
    durationInFrames: maxEndFrame,
    width: ast.dimensions.width,
    height: ast.dimensions.height,
    tracks,
    clips,
  };
}
