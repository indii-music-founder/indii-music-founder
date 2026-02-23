
import { StorageService } from '../StorageService';
import { HistoryItem } from '@/core/types/history';
import { Logger } from '@/core/logger/Logger';
import { events } from '@/core/events';
import { agentZeroService } from './AgentZeroService';

/**
 * AssetObserver monitors the Creative History for newly completed AI assets.
 * When a high-fidelity asset is finalized, it notifies Agent Zero to initiate
 * a proactive "Handover" conversation with the user.
 */
class AssetObserver {
    private unsubscribe: (() => void) | null = null;
    private observedIds: Set<string> = new Set();
    private isInitialized: boolean = false;

    /**
     * Start observing the history for new assets.
     */
    public async initialize() {
        if (this.isInitialized) return;

        Logger.info('AssetObserver', 'Initializing Creative Asset Observer...');

        try {
            this.unsubscribe = await StorageService.subscribeToHistory(10, (items) => {
                this.processUpdates(items);
            }, (error) => {
                Logger.error('AssetObserver', 'Subscription Error:', error);
            });

            this.isInitialized = true;
        } catch (error) {
            Logger.error('AssetObserver', 'Initialization Failed:', error);
        }
    }

    /**
     * Stops the observer.
     */
    public stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.isInitialized = false;
    }

    /**
     * Processes new items and triggers agentic flow if criteria are met.
     */
    private processUpdates(items: HistoryItem[]) {
        // Only look at the most recent generated items
        const generatedItems = items.filter(item =>
            item.origin === 'generated' &&
            !this.observedIds.has(item.id) &&
            !item.url.startsWith('placeholder:')
        );

        for (const item of generatedItems) {
            // Check if it's "final" - has a valid URL and isn't a partial/failed state
            if (item.url && (item.url.startsWith('https://') || item.url.startsWith('img://'))) {
                this.handleNewlyFinalizedAsset(item);
                this.observedIds.add(item.id);

                // Keep the set size manageable
                if (this.observedIds.size > 100) {
                    const firstId = this.observedIds.values().next().value;
                    if (firstId) this.observedIds.delete(firstId);
                }
            }
        }
    }

    /**
     * Notifies Agent Zero about the new asset.
     */
    private handleNewlyFinalizedAsset(item: HistoryItem) {
        Logger.info('AssetObserver', `New asset detected: ${item.type} (${item.id})`);

        // Emit internal event for UI updates or other services
        events.emit('ASSET_FINALIZED', { item });

        // Trigger Agent Zero's proactive logic
        // We wrap this in a timeout to ensure the UI has updated first
        setTimeout(async () => {
            try {
                await agentZeroService.triggerDistributionRelay(item);
            } catch (err) {
                Logger.error('AssetObserver', 'Failed to trigger distribution relay:', err);
            }
        }, 2000);
    }
}

export const assetObserver = new AssetObserver();
