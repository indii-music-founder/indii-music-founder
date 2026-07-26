import { describe, expect, it } from 'vitest';

import type { VideoProject } from '../../store/videoEditorStore';
import { cloudRenderEligibilityError } from './renderEligibility';

const project = (clips: VideoProject['clips']): VideoProject => ({
    id: 'project-1', name: 'Test', fps: 30, durationInFrames: 150, width: 1920, height: 1080,
    tracks: [], clips,
});

describe('cloudRenderEligibilityError', () => {
    it('rejects preview-only video and audio before the callable is invoked', () => {
        expect(cloudRenderEligibilityError(project([
            { id: 'video', type: 'video', src: 'https://attacker.example/clip.mp4', startFrame: 0, durationInFrames: 150, trackId: 'video', name: 'Preview' },
            { id: 'audio', type: 'audio', src: 'https://attacker.example/master.wav', startFrame: 0, durationInFrames: 150, trackId: 'audio', name: 'Preview master' },
        ]))).toContain('secure media library');
    });

    it('accepts a project with canonical video and a canonical master', () => {
        expect(cloudRenderEligibilityError(project([
            { id: 'video', type: 'video', src: 'https://preview.example/clip.mp4', canonicalSourceUri: 'gs://bucket/creative/owner/outputs/clip.mp4', startFrame: 0, durationInFrames: 150, trackId: 'video', name: 'Video' },
            {
                id: 'audio', type: 'audio', src: 'https://preview.example/master.wav', startFrame: 0, durationInFrames: 150, trackId: 'audio', name: 'Master',
                canonicalMaster: { storagePath: `masters/owner/${'a'.repeat(64)}/original.wav`, contentHash: 'a'.repeat(64), generation: '123', masterFingerprint: 'SONIC-a', volume: 1 },
            },
        ]))).toBeUndefined();
    });
});
