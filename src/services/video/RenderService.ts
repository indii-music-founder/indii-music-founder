import { renderMedia, RenderMediaOptions } from '@remotion/renderer';
import { logger } from '@/utils/logger';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { RemotionLambdaConfig } from '../../../remotion.lambda';

export interface RenderConfig {
    compositionId: string;
    outputLocation: string; // Used for local rendering
    inputProps: Record<string, unknown>;
    codec?: 'h264' | 'vp8';
    useCloudQueue?: boolean; // Toggles Lambda vs Local
}

export interface CloudRenderResponse {
    renderId: string;
    bucketName: string;
}

export class RenderService {
    /**
     * Dispatches a render job to the cloud (AWS Lambda) so it doesn't block the UI/Electron thread.
     */
    async renderCompositionCloud(config: RenderConfig): Promise<CloudRenderResponse> {
        try {
            logger.info(`[CloudRenderService] Dispatching cloud render for ${config.compositionId}...`);

            // This requires IAM credentials configured in the environment:
            // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
            // The site name usually points to the pre-deployed remotion bundle in S3.
            const siteName = import.meta.env.VITE_REMOTION_SITE_NAME || 'indii-os-remotion-site';

            const response = await renderMediaOnLambda({
                region: RemotionLambdaConfig.region,
                functionName: `remotion-render-${RemotionLambdaConfig.region}`, // Standard naming
                serveUrl: siteName,
                composition: config.compositionId,
                inputProps: config.inputProps,
                codec: config.codec || 'h264',
                imageFormat: 'jpeg',
                maxRetries: 1,
                privacy: 'public',
                framesPerLambda: 15,
            });

            logger.info(`[CloudRenderService] Cloud render dispatched successfully. ID: ${response.renderId}`);

            return {
                renderId: response.renderId,
                bucketName: response.bucketName
            };

        } catch (error: unknown) {
            logger.error('[CloudRenderService] Cloud render dispatch failed:', error);
            throw new Error(`Failed to dispatch cloud render: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Polls the cloud render progress given a renderId and bucketName.
     */
    async getCloudRenderProgress(renderId: string, bucketName: string) {
        try {
            return await getRenderProgress({
                renderId,
                bucketName,
                functionName: `remotion-render-${RemotionLambdaConfig.region}`,
                region: RemotionLambdaConfig.region,
            });
        } catch (error: unknown) {
            logger.error('[CloudRenderService] Failed to get progress:', error);
            throw error;
        }
    }

    /**
     * Renders a Remotion composition to a local file.
     * Note: This requires a Node.js environment (Electron Main process or Server).
     * In the browser/renderer process, this will throw an error or need a cloud delegate.
     */
    async renderComposition(config: RenderConfig): Promise<string> {
        // If the configuration explicitly asks for the cloud queue, delegate it
        if (config.useCloudQueue) {
            const cloudResponse = await this.renderCompositionCloud(config);
            // In a real application we would store the renderId and poll.
            // For now, we return the stringified response indicating it's processing in the queue.
            return `CLOUD_QUEUED:${cloudResponse.renderId}:${cloudResponse.bucketName}`;
        }

        try {
            logger.info(`[RenderService] Starting local render for ${config.compositionId}...`);

            // In a real implementation, we would bundle the composition first
            // or point to a pre-bundled serve URL.
            // The bundle location is configured via environment variable.
            const bundleLocation = import.meta.env.VITE_REMOTION_BUNDLE_PATH || './dist/remotion-bundle';

            await renderMedia({
                composition: {
                    id: config.compositionId,
                    props: config.inputProps as unknown as Record<string, unknown>,
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    durationInFrames: 300, // Default 10s
                },
                serveUrl: bundleLocation,
                codec: config.codec || 'h264',
                outputLocation: config.outputLocation,
            } as RenderMediaOptions);

            logger.info(`[RenderService] Render complete: ${config.outputLocation}`);
            return config.outputLocation;

        } catch (error: unknown) {
            logger.error('[RenderService] Render failed:', error);
            throw new Error(`Failed to render composition: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

export const renderService = new RenderService();
