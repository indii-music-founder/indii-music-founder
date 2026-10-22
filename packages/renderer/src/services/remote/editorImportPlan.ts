import type { AgentDispatchTask } from '@/services/agent/RemoteRelayService';

/** Choose one destination and one matching asset; never silently import another URL. */
export function editorImportPlan(payload: AgentDispatchTask['payload']) {
    const mediaType = payload.mediaType ?? (payload.imageUrl ? 'image' : payload.audioUrl ? 'audio' : 'video');
    const mediaUrl = mediaType === 'image' ? payload.imageUrl : mediaType === 'audio' ? payload.audioUrl : payload.videoUrl;
    if (!mediaUrl || !/^https:\/\//i.test(mediaUrl)) throw new Error('A secure uploaded media URL matching the media type is required.');
    const destination = payload.editorDestination ?? (mediaType === 'image' ? 'photo' : 'video');
    if (destination !== 'photo' && destination !== 'video') throw new Error('Unknown editor destination.');
    if (destination === 'photo' && mediaType !== 'image') throw new Error('The photo editor requires an image.');
    return { mediaType, mediaUrl, destination, title: payload.title?.trim() || 'Mobile capture' };
}
