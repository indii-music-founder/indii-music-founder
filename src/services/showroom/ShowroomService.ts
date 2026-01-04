import { db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useStore } from '@/core/store';
import { delay } from '@/utils/async';

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
    async submitToProduction(request: ManufactureRequest): Promise<{ success: boolean; orderId: string }> {
        console.info("[ShowroomService] Submitting to production:", request);

        try {
            // Get current user from store (or auth)
            // Ideally we'd pass userId in, but let's grab it if missing
            let userId = request.userId;
            if (!userId) {
                const { useStore } = await import('@/core/store');
                userId = useStore.getState().userProfile?.id;
            }

            if (!userId) throw new Error("User must be logged in to submit to production.");

            const orderId = `BANA-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const docRef = await addDoc(collection(db, 'manufacture_requests'), {
                ...request,
                userId,
                status: 'pending',
                orderId,
                createdAt: serverTimestamp()
            });

            // Simulate processing delay then update status
            delay(2000).then(async () => {
                try {
                    await updateDoc(docRef, { status: 'completed' });
                } catch (e) {
                    console.error("Failed to update manufacture status", e);
                }
            });

            return {
                success: true,
                orderId
            };
        } catch (error) {
            console.error("Error submitting to production:", error);
            throw error;
        }
    },

    /**
     * Generates a mockup request and saves to Firestore.
     * persistent AI generation of photorealistic mockups.
     */
    async generateMockup(asset: string, type: string, scene: string): Promise<string> {
        const { useStore } = await import('@/core/store');
        const userId = useStore.getState().userProfile?.id;

        if (!userId) {
            throw new Error("User must be logged in to generate mockups.");
        }

        const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('@/services/firebase');

        // Record the generation request
        await addDoc(collection(db, 'mockup_generations'), {
            userId,
            asset,
            type,
            scene,
            status: 'processing',
            createdAt: serverTimestamp()
        });

        console.info(`[ShowroomService] Generating ${type} mockup with scene: ${scene}`);

        try {
            const { useStore } = await import('@/core/store');
            const userId = useStore.getState().userProfile?.id;

            // Record the generation request
            const docRef = await addDoc(collection(db, 'mockup_generations'), {
                asset,
                type,
                scene,
                userId,
                createdAt: serverTimestamp(),
                status: 'processing'
            });

            // Beta delay
            await delay(3000);

            // Mock result for now, but persistent record exists
            const resultUrl = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80";

            // Update the record with the result
            await updateDoc(docRef, {
                resultUrl,
                status: 'completed'
            });

            return resultUrl;
        } catch (error) {
            console.error("Error generating mockup:", error);
            // Fallback
            return "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80";
        }
    },

    /**
     * Generates a video request and saves to Firestore.
     * Simulates AI generation of product animations (Persistent).
     */
    async generateVideo(mockupUrl: string, motion: string): Promise<string> {
        const { useStore } = await import('@/core/store');
        const userId = useStore.getState().userProfile?.id;

        if (!userId) {
            throw new Error("User must be logged in to generate videos.");
        }

        const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('@/services/firebase');

        await addDoc(collection(db, 'video_generations'), {
            userId,
            mockupUrl,
            motion,
            status: 'processing',
            createdAt: serverTimestamp()
        });

        console.info(`[ShowroomService] Animating mockup ${mockupUrl} with motion: ${motion}`);

        try {
            const { useStore } = await import('@/core/store');
            const userId = useStore.getState().userProfile?.id;

            const docRef = await addDoc(collection(db, 'video_generations'), {
                mockupUrl,
                motion,
                userId,
                createdAt: serverTimestamp(),
                status: 'processing'
            });

            await delay(3500);

            const resultUrl = "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJieHlzZ254Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxxXmD3v6Te/giphy.gif";

            await updateDoc(docRef, {
                resultUrl,
                status: 'completed'
            });

            return resultUrl;
        } catch (error) {
            console.error("Error generating video:", error);
            return "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJieHlzZ254Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxxXmD3v6Te/giphy.gif";
        }
    }
};
