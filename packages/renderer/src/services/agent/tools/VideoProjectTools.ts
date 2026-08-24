import { useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';
import { renderVideoProjectLocally } from '@/services/video/LocalVideoProjectRenderer';

import type { AnyToolFunction } from '../types';
import { toolError, toolSuccess, wrapTool } from '../utils/ToolUtils';

import type { IndiiVideoClip } from '@indii/shared';

interface QueueVideoRenderArgs {
    projectId?: string;
    outputName?: string;
}

interface AddVideoClipFields {
    type: IndiiVideoClip['type'];
    name: string;
    trackId?: string;
    src?: string;
    text?: string;
    startFrame: number;
    durationInFrames: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    opacity?: number;
    rotation?: number;
    volume?: number;
    textColor?: string;
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right';
}

type AddVideoClipArgs = AddVideoClipFields & Record<string, unknown>;

type UpdateVideoClipArgs = Partial<Omit<AddVideoClipFields, 'type'>> & Record<string, unknown> & {
    clipId: string;
};

const finiteInteger = (value: unknown, field: string, minimum = 0): number => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
        throw new TypeError(`${field} must be an integer greater than or equal to ${minimum}.`);
    }
    return value;
};

const finiteOptional = (value: unknown, field: string): number | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number.`);
    return value;
};

const editableClipFields = (args: AddVideoClipArgs | UpdateVideoClipArgs): Partial<IndiiVideoClip> => ({
    ...(args.name !== undefined ? { name: String(args.name).trim().slice(0, 200) } : {}),
    ...(args.src !== undefined ? { src: String(args.src).trim() } : {}),
    ...(args.text !== undefined ? { text: String(args.text).slice(0, 10_000) } : {}),
    ...(args.startFrame !== undefined ? { startFrame: finiteInteger(args.startFrame, 'startFrame') } : {}),
    ...(args.durationInFrames !== undefined ? { durationInFrames: finiteInteger(args.durationInFrames, 'durationInFrames', 1) } : {}),
    ...Object.fromEntries(
        (['x', 'y', 'width', 'height', 'opacity', 'rotation', 'volume', 'fontSize'] as const)
            .map(field => [field, finiteOptional(args[field], field)])
            .filter((entry): entry is [typeof entry[0], number] => entry[1] !== undefined),
    ),
    ...(args.textColor !== undefined ? { textColor: String(args.textColor).slice(0, 64) } : {}),
    ...(args.textAlign !== undefined ? { textAlign: args.textAlign } : {}),
});

export const VideoProjectTools: Record<string, AnyToolFunction> = {
    inspect_video_project: wrapTool('inspect_video_project', async () => {
        const project = useVideoEditorStore.getState().project;
        return toolSuccess({ project }, `The active project has ${project.tracks.length} tracks and ${project.clips.length} clips.`);
    }),

    add_video_clip: wrapTool('add_video_clip', async (args: AddVideoClipArgs) => {
        const state = useVideoEditorStore.getState();
        const type = args.type;
        if (!['video', 'image', 'text', 'audio'].includes(type)) throw new TypeError('type must be video, image, text, or audio.');
        if (!args.name?.trim()) throw new TypeError('name is required.');
        finiteInteger(args.startFrame, 'startFrame');
        finiteInteger(args.durationInFrames, 'durationInFrames', 1);
        if (type === 'text' && !args.text?.trim()) throw new TypeError('text is required for a text clip.');
        if (type !== 'text' && !args.src?.trim()) throw new TypeError(`src is required for a ${type} clip.`);

        const compatibleTrackType = type === 'image' ? 'video' : type;
        const track = args.trackId
            ? state.project.tracks.find(candidate => candidate.id === args.trackId)
            : state.project.tracks.find(candidate => candidate.type === compatibleTrackType);
        if (!track) throw new Error(`No compatible ${compatibleTrackType} track exists in the active project.`);
        if (track.type !== compatibleTrackType) throw new TypeError(`Track ${track.id} cannot contain a ${type} clip.`);

        const fields = editableClipFields(args);
        const endFrame = (fields.startFrame ?? 0) + (fields.durationInFrames ?? 0);
        if (endFrame > state.getMaxDurationFrames()) throw new Error('The clip exceeds this project membership duration limit.');

        state.addClip({
            type,
            trackId: track.id,
            name: args.name.trim().slice(0, 200),
            startFrame: fields.startFrame!,
            durationInFrames: fields.durationInFrames!,
            ...fields,
        });
        const clip = useVideoEditorStore.getState().project.clips.at(-1)!;
        return toolSuccess({ clip, projectId: state.project.id }, `Added ${clip.name} to the live video timeline.`);
    }),

    update_video_clip: wrapTool('update_video_clip', async (args: UpdateVideoClipArgs) => {
        const state = useVideoEditorStore.getState();
        const clip = state.project.clips.find(candidate => candidate.id === args.clipId);
        if (!clip) return toolError(`Clip ${args.clipId} is not in the active project.`, 'VIDEO_CLIP_NOT_FOUND');
        const updates = editableClipFields(args);
        const nextStart = updates.startFrame ?? clip.startFrame;
        const nextDuration = updates.durationInFrames ?? clip.durationInFrames;
        if (nextStart + nextDuration > state.getMaxDurationFrames()) {
            return toolError('The updated clip exceeds this project membership duration limit.', 'VIDEO_DURATION_LIMIT');
        }
        state.updateClip(clip.id, updates);
        const updated = useVideoEditorStore.getState().project.clips.find(candidate => candidate.id === clip.id)!;
        return toolSuccess({ clip: updated, projectId: state.project.id }, `Updated ${updated.name} on the live video timeline.`);
    }),

    queue_video_render: wrapTool('queue_video_render', async (args: QueueVideoRenderArgs, context) => {
        const project = useVideoEditorStore.getState().project;
        if (args.projectId && args.projectId !== project.id) {
            return toolError(
                `The active video project is ${project.id}; refusing to render a different project (${args.projectId}).`,
                'VIDEO_PROJECT_NOT_ACTIVE',
            );
        }

        const receipt = await renderVideoProjectLocally(project, {
            outputName: args.outputName,
            organizationId: context?.orgId,
        });
        return toolSuccess(
            receipt,
            `Rendered the active video project to ${receipt.asset.url}. The editor preview and project history now reference this artifact.`,
        );
    }),
};
