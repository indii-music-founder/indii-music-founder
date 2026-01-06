import { AppException, AppErrorCode } from '@/shared/types/errors';
import { db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { delay } from '@/utils/async';
import { z } from 'zod';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useStore } from '@/core/store';

// Define Schemas for Validation
const ManufactureRequestSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
    variantId: z.string().min(1, "Variant ID is required"),
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    userId: z.string().optional(),
});

const MockupGenerationSchema = z.object({
    asset: z.string().url("Asset must be a valid URL").or(z.string().min(1, "Asset path is required")), // Accommodate paths or URLs
    type: z.string().min(1, "Type is required"),
    scene: z.string().min(1, "Scene is required"),
});

const VideoGenerationSchema = z.object({
    mockupUrl: z.string().url("Mockup URL must be valid"),
    motion: z.string().min(1, "Motion prompt is required"),
});

export interface ManufactureRequest {
    productId: string;
    variantId: string;
    quantity: number;
    userId?: string;
    status?: 'pending' | 'processing' | 'completed';
    orderId?: string;
    createdAt?: any;
}

export interface MockupGeneration {
    asset: string;
    type: string;
    scene: string;
    resultUrl?: string;
    userId?: string;
    createdAt?: any;
}

export const ShowroomService = {
    /**
     * Submits a design to the production line (Firestore).
     */
    async submitToProduction(input: ManufactureRequest): Promise<{ success: boolean; orderId: string }> {
        // Validate Input
        const request = ManufactureRequestSchema.parse(input);

        console.info("[ShowroomService] Submitting to production:", request);

        try {
            // Get current user from store if not provided
            let userId = request.userId;
            if (!userId) {
                userId = useStore.getState().userProfile?.id;
            }

            if (!userId) {
                throw new AppException(AppErrorCode.AUTH_ERROR, 'User must be logged in to submit to production.');
            }

            const orderId = `BANA-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const docRef = await addDoc(collection(db, 'manufacture_requests'), {
                ...request,
                userId,
                status: 'pending',
                orderId,
                createdAt: serverTimestamp()
            });

            // Simulate processing delay then update status
            // In a real scenario, this would be handled by a backend trigger
            delay(2000).then(async () => {
                try {
                    await updateDoc(docRef, { status: 'completed' });
                } catch (e) {
                    // Status update failed - not critical
                }
            });

            return {
                success: true,
                orderId
            };
        } catch (error) {
            throw error;
        }
    },

    /**
     * Generates a mockup request and saves to Firestore.
     * Uses ImageGenerationService for persistent AI generation.
     */
    async generateMockup(asset: string, type: string, scene: string): Promise<string> {
        // Validate Input
        MockupGenerationSchema.parse({ asset, type, scene });

        const userId = useStore.getState().userProfile?.id;
        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'User must be logged in to generate mockups.');
        }

        console.info(`[ShowroomService] Generating ${type} mockup with scene: ${scene}`);

        // Record the generation request locally for Showroom history
        // Note: ImageGenerationService also tracks usage, but this is for the specific "Showroom" context
        const docRef = await addDoc(collection(db, 'mockup_generations'), {
            userId,
            asset,
            type,
            scene,
            status: 'processing',
            createdAt: serverTimestamp()
        });

        try {
            const prompt = `Professional product photography of a ${type} (${scene}) featuring the design from ${asset}. High resolution, studio lighting, commercial quality.`;

            // Call the real Image Generation Service
            const results = await ImageGeneration.generateImages({
                prompt,
                count: 1,
                aspectRatio: '1:1', // Standard mockup square
                resolution: '1024x1024'
            });

            if (!results || results.length === 0) {
                throw new Error("No image generated.");
            }

            const resultUrl = results[0].url;

            // Update the local Showroom record
            await updateDoc(docRef, {
                resultUrl,
                status: 'completed'
            });

            return resultUrl;
        } catch (error) {
            console.error("Error generating mockup:", error);
            await updateDoc(docRef, { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    },

    /**
     * Generates a video request and saves to Firestore.
     * Uses VideoGenerationService for AI generation.
     */
    async generateVideo(mockupUrl: string, motion: string): Promise<string> {
        // Validate Input
        VideoGenerationSchema.parse({ mockupUrl, motion });

        const userId = useStore.getState().userProfile?.id;
        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'User must be logged in to generate videos.');
        }

        console.info(`[ShowroomService] Animating mockup ${mockupUrl} with motion: ${motion}`);

        // Record the generation request locally for Showroom history
        const docRef = await addDoc(collection(db, 'video_generations'), {
            userId,
            mockupUrl,
            motion,
            status: 'processing',
            createdAt: serverTimestamp()
        });

        try {
            // Trigger the real Video Generation Job
            // We use the mockup image as the first frame
            const jobs = await VideoGeneration.generateVideo({
                prompt: motion,
                firstFrame: mockupUrl,
                motionStrength: 0.5, // Default for showroom animations
                duration: 4 // Standard short loop
            });

            if (!jobs || jobs.length === 0) {
                throw new Error("Failed to start video job.");
            }

            const jobId = jobs[0].id;

            // Wait for the job to complete (bridging the async gap for the UI)
            // In a more advanced UI, we would return the Job ID and let the UI poll,
            // but we are preserving the existing Promise<string> contract for now.
            const completedJob = await VideoGeneration.waitForJob(jobId);

            const resultUrl = completedJob.outputUrl || completedJob.url;

            if (!resultUrl) {
                throw new Error("Job completed but no URL returned.");
            }

            // Update the local Showroom record
            await updateDoc(docRef, {
                resultUrl,
                status: 'completed',
                videoJobId: jobId
            });

            return resultUrl;

        } catch (error) {
            console.error("Error generating video:", error);
            await updateDoc(docRef, { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
};
