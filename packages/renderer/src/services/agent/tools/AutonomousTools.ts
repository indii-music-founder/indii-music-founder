import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { importWithRetry } from '@/utils/dynamicImport';

export const AutonomousTools = {
    /**
     * Saves an unverified artifact-drop draft. Publication, checkout, inventory,
     * fulfillment, and license acceptance are separate capabilities.
     */
    create_artifact_drop: wrapTool('create_artifact_drop', async (args: { 
        title: string,
        description: string,
        priceUsd: number,
        artworkUrl: string,
        audioUrl?: string,
        licenseType: 'Personal' | 'Commercial' | 'Exclusive'
    }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const { userProfile } = useStore.getState();

        if (!userProfile?.id) {
            return toolError("Authentication required to create a drop.", "AUTH_REQUIRED");
        }
        const ownerName = userProfile.displayName?.trim();
        if (!ownerName) {
            return toolError("Display name is required to create an artifact drop.", "OWNER_NAME_REQUIRED");
        }

        try {
            // 1. Create the Artifact record in Firestore
            const dropData = {
                ownerId: userProfile.id,
                ownerName,
                title: args.title,
                description: args.description,
                priceUsd: args.priceUsd,
                artworkUrl: args.artworkUrl,
                audioUrl: args.audioUrl,
                licenseType: args.licenseType,
                status: 'draft_unpublished',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                salesCount: 0,
                type: 'artifact'
            };

            const docRef = await addDoc(collection(db, 'marketplace_drops'), dropData);

            return toolSuccess({
                dropId: docRef.id,
                status: 'draft_unpublished',
                publicationUrl: null,
                checkoutConfigured: false,
                fulfillmentConfigured: false,
                message: `Artifact drop draft "${args.title}" was saved for review.`
            }, `Artifact drop draft "${args.title}" was saved. It is not live and has no purchase URL, accepted license, inventory, payment, or fulfillment workflow.`);

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to create artifact drop: ${message}`, "DROP_FAILED");
        }
    })
} satisfies Record<string, AnyToolFunction>;
