import { describe, it, expect } from 'vitest';
import { projectToTimelineAST, timelineASTToProject } from './nleProjectBridge.js';
import type { IndiiVideoProject } from '@indii/shared';

describe('NLE Project Model Bridge (Issue #413 Phase 4)', () => {
  const sampleProject: IndiiVideoProject = {
    id: 'proj_alpha',
    name: 'Music Video Promo',
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
    tracks: [
      { id: 't_video_1', type: 'video', name: 'Main Video Track', isMuted: false, isLocked: false },
      { id: 't_audio_1', type: 'audio', name: 'Master Audio Track', isMuted: false, isLocked: false },
    ],
    clips: [
      {
        id: 'c_v1',
        name: 'Intro Hook',
        type: 'video',
        src: 'https://cdn.indii.music/intro.mp4',
        trackId: 't_video_1',
        startFrame: 0,
        durationInFrames: 90, // 3 seconds at 30fps
        x: 0,
        y: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 0.85,
        anchorX: 0.5,
        anchorY: 0.5,
        playbackRate: 1.0,
      },
      {
        id: 'c_a1',
        name: 'Bed Music',
        type: 'audio',
        src: 'https://cdn.indii.music/bed.wav',
        trackId: 't_audio_1',
        startFrame: 15, // 0.5s offset
        durationInFrames: 150, // 5 seconds
        volume: 0.75,
        playbackRate: 1.0,
      },
    ],
  };

  it('translates IndiiVideoProject into an immutable TimelineAST with rational time coordinates', () => {
    const ast = projectToTimelineAST(sampleProject);

    expect(ast.version).toBe(1);
    expect(ast.id).toBe('proj_alpha');
    expect(ast.timebase).toBe(60000);
    expect(ast.dimensions).toEqual({ width: 1920, height: 1080 });
    expect(ast.audioFormat).toEqual({ sampleRate: 48000, channels: 2 });
    expect(ast.tracks.length).toBe(2);

    // Track 1 (Video)
    const videoTrack = ast.tracks[0];
    expect(videoTrack.type).toBe('video');
    expect(videoTrack.clips.length).toBe(1);

    const videoClip = videoTrack.clips[0];
    expect(videoClip.id).toBe('c_v1');
    expect(videoClip.type).toBe('video');
    expect(videoClip.timelineRange.start.pts).toBe(0n);
    // 90 frames at 30 fps = 3.0s * 60000 = 180000n PTS
    expect(videoClip.timelineRange.duration.pts).toBe(180000n);
    if (videoClip.type === 'video') {
      expect(videoClip.transform.opacity).toBe(0.85);
      expect(videoClip.transform.scale).toEqual({ x: 1, y: 1 });
      expect(videoClip.transform.origin).toEqual({ x: 0.5, y: 0.5 });
    }

    // Track 2 (Audio)
    const audioTrack = ast.tracks[1];
    expect(audioTrack.type).toBe('audio');
    expect(audioTrack.clips.length).toBe(1);

    const audioClip = audioTrack.clips[0];
    expect(audioClip.id).toBe('c_a1');
    expect(audioClip.type).toBe('audio');
    // 15 frames at 30 fps = 0.5s * 60000 = 30000n PTS
    expect(audioClip.timelineRange.start.pts).toBe(30000n);
    // 150 frames at 30 fps = 5.0s * 60000 = 300000n PTS
    expect(audioClip.timelineRange.duration.pts).toBe(300000n);
    if (audioClip.type === 'audio') {
      expect(audioClip.gain).toBe(0.75);
      expect(audioClip.busAssignment).toBe('master');
    }
  });

  it('performs accurate roundtrip translation from AST back to IndiiVideoProject', () => {
    const ast = projectToTimelineAST(sampleProject);
    const reconstructed = timelineASTToProject(ast, sampleProject.fps);

    expect(reconstructed.id).toBe(sampleProject.id);
    expect(reconstructed.fps).toBe(sampleProject.fps);
    expect(reconstructed.width).toBe(sampleProject.width);
    expect(reconstructed.height).toBe(sampleProject.height);

    expect(reconstructed.tracks.length).toBe(sampleProject.tracks.length);
    expect(reconstructed.clips.length).toBe(sampleProject.clips.length);

    const reconstructedV1 = reconstructed.clips.find((c) => c.id === 'c_v1');
    expect(reconstructedV1).toBeDefined();
    expect(reconstructedV1?.startFrame).toBe(0);
    expect(reconstructedV1?.durationInFrames).toBe(90);
    expect(reconstructedV1?.opacity).toBe(0.85);

    const reconstructedA1 = reconstructed.clips.find((c) => c.id === 'c_a1');
    expect(reconstructedA1).toBeDefined();
    expect(reconstructedA1?.startFrame).toBe(15);
    expect(reconstructedA1?.durationInFrames).toBe(150);
    expect(reconstructedA1?.volume).toBe(0.75);
  });

  it('correctly handles fractional frame rates such as 23.976 fps without drift', () => {
    const ntscProject: IndiiVideoProject = {
      ...sampleProject,
      fps: 23.976023976,
      clips: [
        {
          ...sampleProject.clips[0],
          startFrame: 24, // 1 second approximately
          durationInFrames: 48,
        },
      ],
    };

    const ast = projectToTimelineAST(ntscProject);
    const clip = ast.tracks[0].clips[0];

    // Verify PTS represents integer rational time scaled by 60000
    expect(clip.timelineRange.start.pts).toBeGreaterThan(50000n);
    expect(clip.timelineRange.start.pts).toBeLessThan(70000n);
  });
});
