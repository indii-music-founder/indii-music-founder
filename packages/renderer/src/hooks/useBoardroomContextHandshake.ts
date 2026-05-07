import { useEffect } from 'react';
import { useStore } from '@/core/store';
import type { ReferencedAsset } from '@/core/store/slices/boardroomSlice';

/**
 * ISSUE-033 Fix: Automatic context handshake when entering Boardroom
 *
 * Gathers recent departmental outputs (Creative images, Distribution releases)
 * and auto-injects them as referenced assets so seated agents are aware of
 * studio outputs without manual user intervention.
 */
export function useBoardroomContextHandshake() {
    useEffect(() => {
        const state = useStore.getState();

        // Only run when entering boardroom mode
        if (state.conversationMode !== 'boardroom') {
            return;
        }

        const newAssets: ReferencedAsset[] = [];

        // Gather recent Creative outputs
        if (state.generatedHistory && state.generatedHistory.length > 0) {
            // Take up to 3 most recent images
            const recentImages = state.generatedHistory
                .filter(item => item.type === 'image')
                .slice(0, 3);

            recentImages.forEach(item => {
                if (item.url) {
                    newAssets.push({
                        id: `creative-${item.id}`,
                        name: `Generated Image ${new Date(item.timestamp).toLocaleDateString()}`,
                        type: 'url',
                        value: item.url
                    });
                }
            });
        }

        // Gather recent Distribution outputs
        if (state.distribution && state.distribution.releases && state.distribution.releases.length > 0) {
            // Take up to 2 most recent releases with pending status
            const recentReleases = state.distribution.releases
                .filter((r: any) => r.status === 'pending' || r.status === 'submitted')
                .slice(0, 2);

            recentReleases.forEach((release: any) => {
                newAssets.push({
                    id: `dist-${release.id}`,
                    name: release.projectTitle || `Release: ${release.id}`,
                    type: 'database',
                    value: `Status: ${release.status}, Distributors: ${release.selectedDistributors?.join(', ') || 'none'}`
                });
            });
        }

        // If we have new assets, add them to referenced assets
        if (newAssets.length > 0) {
            // Get current referenced assets and merge (avoid duplicates)
            const currentAssets = state.referencedAssets || [];
            const existingIds = new Set(currentAssets.map(a => a.id));

            const assetsToAdd = newAssets.filter(asset => !existingIds.has(asset.id));

            // Add assets to boardroom
            assetsToAdd.forEach(asset => {
                state.addReferencedAsset(asset);
            });

            // Log the context handshake for debugging
            if (assetsToAdd.length > 0) {
                console.log(`[ISSUE-033] Boardroom context handshake: added ${assetsToAdd.length} assets`, assetsToAdd);
            }
        }
    }, [useStore((state) => state.conversationMode)]);
}
