import { useStore } from '@/core/store';
import { auth } from '@/services/firebase';
import type { AgentDispatchTask } from '@/services/agent/RemoteRelayService';
import { CanvasDocumentService } from '@/services/canvas/CanvasDocumentService';
import { createDocFromImage } from '@/services/canvas/CanvasDoc';
import { editorImportPlan } from './editorImportPlan';

/** Shared by the local capture surface and the paired desktop executor. */
export async function openRemoteMedia(payload: AgentDispatchTask['payload'], taskId?: string): Promise<NonNullable<AgentDispatchTask['result']>> {
    const plan = editorImportPlan(payload);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign in to open this capture.');
    if (plan.destination === 'photo') {
        if (useStore.getState().currentDoc) throw new Error('Close the current artwork on the computer, then retry opening this photo.');
        const projectId = useStore.getState().currentProjectId || 'project_default';
        const created = createDocFromImage(plan.mediaUrl, projectId);
        // A retried dispatch reopens its saved artwork instead of duplicating it.
        if (taskId) created.id = `remote_${taskId}`;
        created.name = plan.title;
        const document = taskId ? await CanvasDocumentService.loadDoc(created.id) ?? created : created;
        const { loadArtworkImage } = await import('@/services/canvas/ArtworkRenderService');
        const image = await loadArtworkImage(plan.mediaUrl, AbortSignal.timeout(30_000));
        image.dispose();
        await CanvasDocumentService.saveDoc(document, uid);
        if (auth.currentUser?.uid !== uid) throw new Error('Sign in again to open this capture.');
        // A save can take time: never overwrite artwork opened while it was pending.
        if (useStore.getState().currentDoc) throw new Error('Photo saved in Saved artwork. Close the current artwork before reopening it.');
        await useStore.getState().setModule('creative');
        if (auth.currentUser?.uid !== uid) throw new Error('Sign in again to open this capture.');
        if (useStore.getState().currentDoc) throw new Error('Photo saved in Saved artwork. Close the current artwork before reopening it.');
        useStore.getState().setViewMode('direct');
        useStore.getState().openDoc(document);
        return { artworkId: document.id, projectId: document.projectId, assetUrl: plan.mediaUrl };
    }
    const { useVideoEditorStore } = await import('@/modules/creative/video/store/videoEditorStore');
    if (auth.currentUser?.uid !== uid) throw new Error('Sign in again to open this capture.');
    useVideoEditorStore.getState().importMediaUrlAsClip(plan.mediaUrl, plan.mediaType, plan.title);
    await useStore.getState().setModule('creative');
    useStore.getState().setViewMode('video_production');
    return { projectId: useVideoEditorStore.getState().project.id, assetUrl: plan.mediaUrl };
}
