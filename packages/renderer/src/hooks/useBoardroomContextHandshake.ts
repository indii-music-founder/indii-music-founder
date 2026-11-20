import type { StoreState } from '@/core/store';
import type { ReferencedAsset } from '@/core/store/slices/boardroomSlice';
import type { ReleaseStatus } from '@/services/distribution/types/distributor';

function isPublishableUrl(url: string | undefined): boolean {
    return !!url && !url.startsWith('data:');
}

function buildCreativeReferencedAsset(item: StoreState['generatedHistory'][number]): ReferencedAsset | null {
    const value = item.storageUri || (isPublishableUrl(item.url) ? item.url : undefined);
    if (!value) {
        return null;
    }

    const label = item.prompt?.trim()
        ? `${item.type.toUpperCase()} · ${item.prompt.trim()}`
        : `Generated ${item.type}`;

    return {
        id: `creative-${item.id}`,
        name: label,
        type: 'url',
        value,
        prompt: item.prompt,
        origin: item.origin,
        parentId: item.parentId,
        storageUri: item.storageUri,
        sourceType: item.type,
    };
}

const actionableReleaseStatuses: ReleaseStatus[] = [
    'draft',
    'validating',
    'ready_for_manual_submission',
    'pending_review',
    'in_review',
    'approved',
    'processing',
    'delivering',
];

function isActionableRelease(release: NonNullable<StoreState['distribution']>['releases'][number]): boolean {
    return Object.values(release.deployments).some(deployment => actionableReleaseStatuses.includes(deployment.status));
}

function buildDistributionReferencedAsset(release: NonNullable<StoreState['distribution']>['releases'][number]): ReferencedAsset {
    const deploymentSummary = Object.entries(release.deployments)
        .map(([distributorId, deployment]) => `${distributorId}:${deployment.status}`)
        .join(', ');

    return {
        id: `dist-${release.id}`,
        name: `DISTRIBUTION · ${release.title || release.artist || release.id}`,
        type: 'database',
        value: `Artist: ${release.artist}; Deployments: ${deploymentSummary || 'none'}`,
        origin: 'distribution',
        prompt: release.marketingComment || release.title || undefined,
        parentId: release.id,
        sourceType: 'text',
    };
}

/**
 * Centrally publishes/synchronizes current workspace assets (Creative, Distribution)
 * into the Boardroom's referenced assets context.
 */
export function publishBoardroomContextUpdate(state: Pick<StoreState,
    'conversationMode' | 'generatedHistory' | 'distribution' | 'addAutomaticReferencedAssets'
>) {
    if (state.conversationMode !== 'boardroom') return;
    const newAssets: ReferencedAsset[] = [];

    // Gather recent Creative outputs
    if (state.generatedHistory && state.generatedHistory.length > 0) {
        // Take up to 3 most recent creative outputs with durable URLs.
        const recentCreativeAssets = state.generatedHistory
            .filter(item => ['image', 'video', 'music'].includes(item.type))
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(buildCreativeReferencedAsset)
            .filter((asset): asset is ReferencedAsset => asset !== null)
            .slice(0, 3);

        newAssets.push(...recentCreativeAssets);
    }

    // Gather recent Distribution outputs
    if (state.distribution && state.distribution.releases && state.distribution.releases.length > 0) {
        // Take up to 2 most recent actionable releases.
        const recentReleases = state.distribution.releases
            .filter(isActionableRelease)
            .slice(0, 2);

        recentReleases.forEach((release) => {
            newAssets.push(buildDistributionReferencedAsset(release));
        });
    }

    if (newAssets.length) state.addAutomaticReferencedAssets(newAssets);
}
