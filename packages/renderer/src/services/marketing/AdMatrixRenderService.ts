import type { CompiledAdMatrixVariant } from '@indii/video-compiler';

export async function uploadAdMatrixFootage(file: File): Promise<string> {
    const { auth } = await import('@/services/firebase');
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to upload source footage.');
    if (!file.type.startsWith('video/') || file.size === 0 || file.size >= 500 * 1024 * 1024) {
        throw new Error('Choose a video file smaller than 500 MB.');
    }
    const { VideoUploadService } = await import('@/services/video/VideoUploadService');
    const upload = await VideoUploadService.uploadVideo(file, `videos/${userId}/ad-matrix/${crypto.randomUUID()}`);
    return upload.storageUri;
}

export async function renderAdMatrixVariant(variant: CompiledAdMatrixVariant) {
    const [
        { auth },
        { loadVideoProject, saveVideoProject },
        { queueCloudRender, waitForCloudRender },
        { extractVideoFrameAt },
    ] = await Promise.all([
        import('@/services/firebase'),
        import('@/modules/creative/video/services/VideoProjectPersistenceService'),
        import('@/services/video/CloudVideoRenderService'),
        import('@/utils/video'),
    ]);
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to render ad cuts.');

    // Give each attempt its own project. The queue snapshots the exact cut,
    // including refinements, without modifying the artist's editor timeline.
    const project = { ...variant.project, id: crypto.randomUUID() };
    const timeline = await loadVideoProject(project.id, userId);
    if (timeline.status !== 'absent') throw new Error('Could not initialize the ad cut timeline.');
    const saved = await saveVideoProject(timeline.token, project, userId, null);
    if (!saved.success) throw new Error(saved.reason || 'Could not save the ad cut timeline.');

    const { renderId } = await queueCloudRender(project.id, `ad-matrix-${project.id}.mp4`);
    const { url } = await waitForCloudRender(renderId);
    if (!url.startsWith('https://')) throw new Error('The completed cut has no shareable HTTPS render.');
    const keyframes: string[] = [];
    for (const timestamp of [0.5, variant.durationSeconds / 2, variant.durationSeconds - 0.5]) {
        const frame = await extractVideoFrameAt(url, timestamp, { maxFrameDimension: 768 });
        keyframes.push(frame.dataUrl);
    }
    return { keyframes, renderUrl: url };
}
