

export const electronRenderService = {
    async render(config: { compositionId: string; outputLocation: string; inputProps?: Record<string, unknown> }) {
        console.log('[ElectronRenderService] Rendering composition:', config.compositionId);
        
        try {
            // Dynamically import @remotion/renderer so that it doesn't break if not available
            const { renderMedia } = await import('@remotion/renderer');
            type RenderMediaParams = Parameters<typeof renderMedia>[0];
            
            const serveUrl = process.env.REMOTION_BUNDLE_PATH || './dist/remotion-bundle';
            
            await renderMedia({
                composition: {
                    id: config.compositionId,
                    props: config.inputProps || {},
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    durationInFrames: 300,
                    defaultProps: {},
                } as unknown as RenderMediaParams['composition'],
                serveUrl,
                codec: 'h264',
                outputLocation: config.outputLocation,
            } as RenderMediaParams);
            
            console.log('[ElectronRenderService] Rendering complete:', config.outputLocation);
            return config.outputLocation;
        } catch (error) {
            console.error('[ElectronRenderService] Rendering failed:', error);
            throw error;
        }
    }
};
