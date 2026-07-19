import type { HistoryItem } from '@/core/types/history';
import { extractVideoFrame, type VideoFramePosition } from '@/utils/video';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { CreativeStorageService } from './CreativeStorageService';

export type HandoffFramePosition = Extract<VideoFramePosition, 'first' | 'last'>;

/**
 * Persist a real image frame from a video so it can safely cross into Veo or
 * the Image Studio. Veo cannot extend an Omni-created video directly, but it
 * can continue from a frame extracted from that video.
 */
export async function materializeVideoFrameForHandoff(
    item: HistoryItem,
    position: HandoffFramePosition,
    options: {
        userId: string;
        projectId?: string;
    },
): Promise<HistoryItem> {
    if (item.type !== 'video') {
        throw new Error('Only video assets can be converted into handoff frames.');
    }

    const source = item.storageUri || item.url;
    if (!source) {
        throw new Error('The source video is unavailable.');
    }

    const dataUrl = await extractVideoFrame(source, position, { fps: 24 });
    const storageUri = await CreativeStorageService.uploadReferenceMedia(
        options.userId,
        dataUrl,
        'image',
        {
            projectId: options.projectId || item.projectId || undefined,
            scope: 'assets',
        },
    );
    const url = await resolveStorageUrl(storageUri);
    const label = position === 'last' ? 'Last' : 'First';

    return {
        id: `${item.id}-${position}-frame-${crypto.randomUUID()}`,
        type: 'image',
        url,
        storageUri,
        prompt: `${label} frame from: ${item.prompt || 'video'}`,
        timestamp: Date.now(),
        projectId: options.projectId || item.projectId || '',
        orgId: item.orgId,
        origin: item.origin || 'generated',
        parentId: item.id,
    };
}
