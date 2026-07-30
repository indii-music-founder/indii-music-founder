import type {
    CanonicalMasterRenderReference,
    VideoClip,
    VideoProject,
} from '../store/videoEditorStore';
import type { StoryboardProject } from '../schemas/storyboard';

export class StoryboardRenderContractError extends Error {
    readonly code = 'STORYBOARD_PRIVATE_RENDER_INVALID';

    constructor(message: string) {
        super(message);
        this.name = 'StoryboardRenderContractError';
    }
}

function canonicalMasterFrom(project: VideoProject): {
    master: CanonicalMasterRenderReference;
    previewSource?: string;
} {
    const candidates = project.clips.filter(
        (clip): clip is VideoClip & { canonicalMaster: CanonicalMasterRenderReference } =>
            clip.type === 'audio' && clip.canonicalMaster !== undefined,
    );
    if (candidates.length !== 1) {
        throw new StoryboardRenderContractError(
            'Compile requires exactly one verified canonical master; audio cannot be omitted or inferred from a preview.',
        );
    }
    const clip = candidates[0];
    const master = clip.canonicalMaster;
    if (
        !/^masters\/[A-Za-z0-9_-]{1,128}\/[a-f0-9]{64}\/original\.(wav|flac)$/.test(master.storagePath)
        || !/^[a-f0-9]{64}$/.test(master.contentHash)
        || !/^[1-9][0-9]{0,29}$/.test(master.generation)
        || !master.masterFingerprint.trim()
        || master.volume <= 0
        || master.volume > 1
    ) {
        throw new StoryboardRenderContractError('The canonical master identity is malformed.');
    }
    return { master, ...(clip.src ? { previewSource: clip.src } : {}) };
}

export function compileStoryboardRenderProject(input: {
    storyboard: StoryboardProject;
    activeProject: VideoProject;
    expectedProjectId: string;
}): VideoProject {
    const { storyboard, activeProject, expectedProjectId } = input;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(expectedProjectId) || activeProject.id !== expectedProjectId) {
        throw new StoryboardRenderContractError('The storyboard is not bound to the active app project.');
    }
    if (!storyboard.audioUrl || !storyboard.audioUrl.startsWith('gs://')) {
        throw new StoryboardRenderContractError(
            'The storyboard audio is preview-only. Select a canonical project master before compiling.',
        );
    }
    const { master, previewSource } = canonicalMasterFrom(activeProject);
    if (storyboard.slots.length === 0) {
        throw new StoryboardRenderContractError('The storyboard has no renderable slots.');
    }

    const fps = activeProject.fps;
    const videoTrackId = 'storyboard-video';
    const audioTrackId = 'storyboard-master';
    const videoClips: VideoClip[] = storyboard.slots.map((slot, index) => {
        if (!slot.videoUrl) {
            throw new StoryboardRenderContractError(`Storyboard slot ${index + 1} has not completed.`);
        }
        if (!slot.canonicalVideoUri || !slot.canonicalVideoUri.startsWith('gs://')) {
            throw new StoryboardRenderContractError(
                `Storyboard slot ${index + 1} has only a preview/public source and cannot be rendered.`,
            );
        }
        const startFrame = Math.round(slot.startBar * 4 * (60 / storyboard.bpm) * fps);
        const durationInFrames = Math.max(
            1,
            Math.round(slot.durationBars * 4 * (60 / storyboard.bpm) * fps),
        );
        return {
            id: `storyboard-slot-${slot.id}`,
            type: 'video',
            src: slot.videoUrl,
            canonicalSourceUri: slot.canonicalVideoUri,
            startFrame,
            durationInFrames,
            trackId: videoTrackId,
            name: `Storyboard segment ${index + 1}`,
        };
    });
    const durationInFrames = Math.max(
        Math.round(storyboard.durationSeconds * fps),
        ...videoClips.map(clip => clip.startFrame + clip.durationInFrames),
    );

    return {
        id: expectedProjectId,
        name: storyboard.name,
        fps,
        durationInFrames,
        width: activeProject.width,
        height: activeProject.height,
        tracks: [
            { id: videoTrackId, name: 'Storyboard video', type: 'video' },
            { id: audioTrackId, name: 'Canonical master', type: 'audio' },
        ],
        clips: [
            ...videoClips,
            {
                id: 'storyboard-canonical-master',
                type: 'audio',
                ...(previewSource ? { src: previewSource } : {}),
                canonicalMaster: master,
                startFrame: 0,
                durationInFrames,
                trackId: audioTrackId,
                name: 'Canonical master',
                volume: master.volume,
            },
        ],
    };
}
