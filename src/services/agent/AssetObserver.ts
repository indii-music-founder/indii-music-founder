
import { StorageService } from '../StorageService';
import { HistoryItem } from '@/core/types/history';
import { Logger } from '@/core/logger/Logger';
import { events } from '@/core/events';

/**
 * AssetObserver monitors the Creative History for newly completed AI assets.
 * When a high-fidelity asset is finalized, it notifies Agent Zero to initiate
 * a proactive "Handover" conversation with the user.
 */
class AssetObserver {
    private unsubscribe: (() => void) | null = null;
    private observedIds: Set<string> = new Set();
    private isInitialized: boolean = false;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private relayTimers: Set<ReturnType<typeof setTimeout>> = new Set();
    private retryCount: number = 0;
    private readonly MAX_RETRIES = 3;

    /**
     * Start observing the history for new assets.
     */
    public async initialize() {
        if (this.isInitialized) return;

        Logger.info('AssetObserver', 'Initializing Creative Asset Observer...');

        try {
            this.unsubscribe = await StorageService.subscribeToHistory(10, (items) => {
                this.retryCount = 0; // Reset retries on successful data push
                this.processUpdates(items);
            }, (error) => {
                const isPermissionError = error?.message?.includes('Missing or insufficient permissions');

                if (isPermissionError && this.retryCount < this.MAX_RETRIES) {
                    this.retryCount++;
                    const backoffMs = Math.pow(2, this.retryCount) * 1000; // 2s, 4s, 8s
                    Logger.warn('AssetObserver', `Permission error, retrying in ${backoffMs / 1000}s (attempt ${this.retryCount}/${this.MAX_RETRIES})`);

                    // Clean up existing subscription and retry after backoff
                    if (this.unsubscribe) {
                        this.unsubscribe();
                        this.unsubscribe = null;
                    }
                    this.isInitialized = false;

                    this.retryTimer = setTimeout(() => {
                        this.initialize();
                    }, backoffMs);
                } else {
                    // Permanent error or max retries hit — log and give up gracefully
                    Logger.error('AssetObserver', 'Subscription Error (non-recoverable):', error);
                }
            });

            this.isInitialized = true;
            this.retryCount = 0;
        } catch (error) {
            Logger.error('AssetObserver', 'Initialization Failed:', error);
        }
    }

    /**
     * Stops the observer.
     */
    public stop() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        // Clear all pending relay timeouts to prevent zombie events
        for (const timer of this.relayTimers) {
            clearTimeout(timer);
        }
        this.relayTimers.clear();
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.isInitialized = false;
        this.retryCount = 0;
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

        // Emit distribution relay event — downstream listeners handle proactive handover
        const timerId = setTimeout(() => {
            events.emit('DISTRIBUTION_RELAY_READY', { item });
            this.relayTimers.delete(timerId);
        }, 2000);
        this.relayTimers.add(timerId);
    }
}

export const assetObserver = new AssetObserver();
