

export const electronRenderService = {
    async render(config: { compositionId: string; outputLocation: string; inputProps?: Record<string, unknown> }) {
        void 0;
        
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
            
            void 0;
            return config.outputLocation;
        } catch (error) {
            void 0;
            throw error;
        }
    }
};
