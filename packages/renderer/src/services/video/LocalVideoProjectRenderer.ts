import type { CompletedRenderReceipt, IndiiVideoProject } from '@indii/shared';

import { useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';

interface DesktopVideoApi {
    getDefaultPath?(filename?: string): Promise<string>;
    render(config: {
        compositionId: string;
        outputLocation: string;
        inputProps: { project: IndiiVideoProject };
    }): Promise<string>;
}

export interface LocalVideoRenderOptions {
    outputLocation?: string;
    outputName?: string;
    organizationId?: string;
}

interface LocalVideoRenderDependencies {
    videoApi: DesktopVideoApi;
    now: () => number;
    createRenderId: () => string;
    recordArtifact: (
        receipt: CompletedRenderReceipt,
        project: IndiiVideoProject,
        organizationId?: string,
    ) => Promise<void>;
}

const safeOutputName = (project: IndiiVideoProject, requested: string | undefined, now: number): string => {
    const source = requested?.trim() || `${project.name || 'video'}-${now}.mp4`;
    const basename = source.split(/[\\/]/).pop() || `video-${now}.mp4`;
    const sanitized = basename.replace(/[^a-z0-9._-]/gi, '_');
    return sanitized.toLowerCase().endsWith('.mp4') ? sanitized : `${sanitized}.mp4`;
};

const fileUrl = (output: string): string => output.startsWith('file://') ? output : `file://${output}`;

const defaultDependencies = (): LocalVideoRenderDependencies => {
    const videoApi = typeof window !== 'undefined' ? window.electronAPI?.video : undefined;
    if (!videoApi?.render) {
        throw new Error('Local video rendering requires the indii desktop app.');
    }

    return {
        videoApi,
        now: () => Date.now(),
        createRenderId: () => crypto.randomUUID(),
        recordArtifact: async (receipt, project, organizationId) => {
            useVideoEditorStore.getState().setPreviewArtifactUrl(receipt.asset.url);
            try {
                const { useStore } = await import('@/core/store');
                const appStore = useStore.getState();
                appStore.addToHistory?.({
                    id: `export_${receipt.renderId}`,
                    type: 'video',
                    url: receipt.asset.url,
                    localPath: receipt.asset.url.replace(/^file:\/\//, ''),
                    origin: 'editor',
                    prompt: `Export of ${project.name || 'Project'}`,
                    timestamp: Date.now(),
                    projectId: project.id,
                    orgId: organizationId ?? appStore.currentOrganizationId,
                });
            } catch (error) {
                // The render already completed and remains available in preview.
                // Optional library bookkeeping must not turn that success into a failure.
                console.warn('[LocalVideoProjectRenderer] Could not add render to history:', error);
            }
        },
    };
};

/**
 * The single renderer-process entry point for an agent or editor requesting a
 * local project render. Routing remains main-process owned: Electron applies
 * RenderPlanner and selects FFmpeg or HyperFrames behind the shared contract.
 */
export async function renderVideoProjectLocally(
    project: IndiiVideoProject,
    options: LocalVideoRenderOptions = {},
    dependencies?: LocalVideoRenderDependencies,
): Promise<CompletedRenderReceipt> {
    if (!project.clips.length) {
        throw new Error('The current video project has no clips to render.');
    }

    const deps = dependencies ?? defaultDependencies();
    const startedAt = deps.now();
    const outputName = safeOutputName(project, options.outputName, startedAt);
    const outputLocation = options.outputLocation ?? await (() => {
        if (!deps.videoApi.getDefaultPath) {
            throw new Error('The desktop app could not resolve its managed video folder.');
        }
        return deps.videoApi.getDefaultPath(outputName);
    })();
    const renderedPath = await deps.videoApi.render({
        compositionId: project.id,
        outputLocation,
        inputProps: { project },
    });
    const receipt: CompletedRenderReceipt = {
        status: 'completed',
        renderId: deps.createRenderId(),
        projectId: project.id,
        progress: 100,
        asset: {
            url: fileUrl(renderedPath),
            expiresAt: Number.MAX_SAFE_INTEGER,
            generation: `local-${startedAt}`,
            mimeType: 'video/mp4',
        },
    };
    await deps.recordArtifact(receipt, project, options.organizationId);
    return receipt;
}
