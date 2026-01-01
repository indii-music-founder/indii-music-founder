/**
 * ShowroomService.ts
 * Logic for handling merchandise design generation and production submission in the Beta.
 */

export interface ManufactureRequest {
    productId: string;
    variantId: string;
    quantity: number;
}

export const ShowroomService = {
    /**
     * Simulates submitting a design to the production line.
     */
    async submitToProduction(request: ManufactureRequest): Promise<{ success: boolean; orderId: string }> {
        console.log("Submitting to production:", request);

        // Beta delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        return {
            success: true,
            orderId: `BANA-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        };
    },

    /**
     * Generates a mockup request and saves to Firestore.
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

        console.log(`Generating ${type} mockup with scene: ${scene}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Return a mock result
        return "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80";
    },

    /**
     * Generates a video request and saves to Firestore.
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

        console.log(`Animating mockup ${mockupUrl} with motion: ${motion}`);
        await new Promise(resolve => setTimeout(resolve, 3500));
        // Return a mock video link
        return "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJieHlzZ254Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxxXmD3v6Te/giphy.gif";
    }
};
