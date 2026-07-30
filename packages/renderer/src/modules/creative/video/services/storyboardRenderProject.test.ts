import { describe, expect, it } from 'vitest';

import type { StoryboardProject } from '../schemas/storyboard';
import type { VideoProject } from '../store/videoEditorStore';
import {
    compileStoryboardRenderProject,
    StoryboardRenderContractError,
} from './storyboardRenderProject';

const HASH = 'a'.repeat(64);
const canonicalMaster = {
    storagePath: `masters/owner-1/${HASH}/original.wav`,
    contentHash: HASH,
    generation: '123456789',
    masterFingerprint: 'SONIC-master-1',
    volume: 1,
};

function activeProject(): VideoProject {
    return {
        id: 'project-1',
        name: 'Project',
        fps: 30,
        durationInFrames: 240,
        width: 1920,
        height: 1080,
        tracks: [{ id: 'audio', name: 'Master', type: 'audio' }],
        clips: [{
            id: 'master',
            type: 'audio',
            src: 'https://authorized-preview.example/master.wav',
            canonicalMaster,
            startFrame: 0,
            durationInFrames: 240,
            trackId: 'audio',
            name: 'Master',
        }],
    };
}

function storyboard(): StoryboardProject {
    return {
        id: 'storyboard-1',
        name: 'Showreel',
        audioUrl: `gs://bucket/${canonicalMaster.storagePath}`,
        bpm: 120,
        durationSeconds: 8,
        slots: [{
            id: 'slot-1',
            barIndex: 0,
            startBar: 0,
            durationBars: 4,
            prompt: 'Scene',
            videoUrl: 'https://authorized-preview.example/scene.mp4',
            canonicalVideoUri: 'gs://bucket/creative/owner-1/video/outputs/scene.mp4',
            isGenerating: false,
            progress: 100,
            useVocalSync: false,
            useDaisyChain: true,
        }],
    };
}

describe('compileStoryboardRenderProject', () => {
    it('builds a project using canonical video and master identities', () => {
        const result = compileStoryboardRenderProject({
            storyboard: storyboard(),
            activeProject: activeProject(),
            expectedProjectId: 'project-1',
        });

        expect(result.id).toBe('project-1');
        expect(result.clips).toEqual([
            expect.objectContaining({
                canonicalSourceUri: 'gs://bucket/creative/owner-1/video/outputs/scene.mp4',
                durationInFrames: 240,
            }),
            expect.objectContaining({ canonicalMaster, durationInFrames: 240 }),
        ]);
    });

    it.each([
        ['blob audio', (value: StoryboardProject) => { value.audioUrl = 'blob:preview-only'; }],
        ['missing master', (_value: StoryboardProject, project: VideoProject) => { project.clips = []; }],
        ['preview-only video', (value: StoryboardProject) => { delete value.slots[0].canonicalVideoUri; }],
        ['public-only video', (value: StoryboardProject) => { value.slots[0].canonicalVideoUri = 'https://cdn.example/scene.mp4'; }],
        ['missing video slot', (value: StoryboardProject) => { delete value.slots[0].videoUrl; }],
    ])('fails closed for %s', (_label, mutate) => {
        const value = storyboard();
        const project = activeProject();
        mutate(value, project);
        expect(() => compileStoryboardRenderProject({
            storyboard: value,
            activeProject: project,
            expectedProjectId: 'project-1',
        })).toThrow(StoryboardRenderContractError);
    });

    it('rejects a mismatched active app project', () => {
        expect(() => compileStoryboardRenderProject({
            storyboard: storyboard(),
            activeProject: activeProject(),
            expectedProjectId: 'other-project',
        })).toThrow('not bound to the active app project');
    });
});
