import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const SovereignTools = {
    /**
     * Creates a "Sovereign Artifact Drop" - a high-value purchase link for assets.
     * Packages artwork, audio, and a generated license into a single commercial artifact.
     */
    create_artifact_drop: wrapTool('create_artifact_drop', async (args: { 
        title: string,
        description: string,
        priceUsd: number,
        artworkUrl: string,
        audioUrl?: string,
        licenseType: 'Personal' | 'Commercial' | 'Exclusive'
    }) => {
        const { useStore } = await import('@/core/store');
        const { userProfile } = useStore.getState();

        if (!userProfile?.id) {
            return toolError("Authentication required to create a drop.", "AUTH_REQUIRED");
        }

        try {
            // 1. Create the Artifact record in Firestore
            const dropData = {
                ownerId: userProfile.id,
                ownerName: userProfile.displayName || "Sovereign Artist",
                title: args.title,
                description: args.description,
                priceUsd: args.priceUsd,
                artworkUrl: args.artworkUrl,
                audioUrl: args.audioUrl,
                licenseType: args.licenseType,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                salesCount: 0,
                type: 'artifact'
            };

            const docRef = await addDoc(collection(db, 'marketplace_drops'), dropData);
            const dropUrl = `https://indiios.com/drop/${docRef.id}`;

            return toolSuccess({
                dropId: docRef.id,
                url: dropUrl,
                message: `Artifact Drop "${args.title}" created successfully!`
            }, `Your Sovereign Artifact is LIVE. Purchase Link: ${dropUrl}`);

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to create artifact drop: ${message}`, "DROP_FAILED");
        }
    })
} satisfies Record<string, AnyToolFunction>;
