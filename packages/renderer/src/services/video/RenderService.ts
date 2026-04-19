import { renderMedia, RenderMediaOptions } from '@remotion/renderer';
import { logger } from '@/utils/logger';
import { renderMediaOnCloudrun } from '@remotion/cloudrun/client';
import type { GcpRegion } from '@remotion/cloudrun';
import { RemotionCloudRunConfig } from './remotion.cloudrun';

export interface RenderConfig {
    compositionId: string;
    outputLocation: string; // Used for local rendering
    inputProps: Record<string, unknown>;
    codec?: 'h264' | 'vp8';
    useCloudQueue?: boolean; // Toggles Cloud Run vs Local
}

export interface CloudRenderResponse {
    renderId: string;
    bucketName: string;
    publicUrl?: string;
}

export class RenderService {
    /**
     * Dispatches a render job to Google Cloud Run so it doesn't block the UI/Electron thread.
     *
     * Authentication uses Google Application Default Credentials (ADC):
     *   - Locally: `gcloud auth application-default login`
     *   - CI/CD: GOOGLE_APPLICATION_CREDENTIALS service account JSON
     *
     * No AWS credentials required.
     */
    async renderCompositionCloud(
        config: RenderConfig,
        onProgress?: (progress: number) => void
    ): Promise<CloudRenderResponse> {
        try {
            logger.info(`[CloudRenderService] Dispatching GCP Cloud Run render for ${config.compositionId}...`);

            const result = await renderMediaOnCloudrun({
                region: RemotionCloudRunConfig.region as GcpRegion,
                serviceName: RemotionCloudRunConfig.serviceName,
                serveUrl: RemotionCloudRunConfig.siteName,
                composition: config.compositionId,
                inputProps: config.inputProps,
                codec: config.codec || 'h264',
                imageFormat: 'jpeg',
                privacy: 'public',
                updateRenderProgress: (progress: number, error: boolean) => {
                    if (error) {
                        logger.error(`[CloudRenderService] Render progress error for ${config.compositionId}`);
                    } else {
                        const pct = Math.round(progress * 100);
                        logger.info(`[CloudRenderService] Render progress: ${pct}%`);
                        onProgress?.(pct);
                    }
                },
            });

            if (result.type === 'crash') {
                logger.error('[CloudRenderService] Cloud Run service crashed:', result.message);
                throw new Error(
                    `Cloud Run render crashed after ${result.requestElapsedTimeInSeconds}s. ` +
                    `Check GCP Console logs for service: ${RemotionCloudRunConfig.serviceName}. ` +
                    `Message: ${result.message}`
                );
            }

            logger.info(`[CloudRenderService] Cloud Run render completed. ID: ${result.renderId}, URL: ${result.publicUrl || 'private'}`);

            return {
                renderId: result.renderId,
                bucketName: result.bucketName,
                publicUrl: result.publicUrl ?? undefined,
            };

        } catch (error: unknown) {
            logger.error('[CloudRenderService] Cloud Run render dispatch failed:', error);
            throw new Error(`Failed to dispatch Cloud Run render: ${error instanceof Error ? error.message : String(error)}`);
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
            // If we got a public URL back, return it directly
            if (cloudResponse.publicUrl) {
                return cloudResponse.publicUrl;
            }
            // Otherwise return a marker string for the caller to poll
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
