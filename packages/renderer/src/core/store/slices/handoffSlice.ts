import { StateCreator } from 'zustand';
import { SendToTarget, SendToPayload } from '@/types/handoff';
import { logger } from '@/utils/logger';
import { toast } from '@/core/context/ToastContext';

export interface HandoffSlice {
    pendingHandoffs: Partial<Record<SendToTarget, SendToPayload>>;

    /** Stages an asset for handoff, triggers routing, and coordinates transitions */
    sendToModule: (target: SendToTarget, payload: SendToPayload) => void;

    /** Peeks at the pending asset without consuming it (for safe read-then-persist) */
    peekHandoff: (target: SendToTarget) => SendToPayload | null;

    /** Consumes and clears the pending asset after successful persistence */
    consumeHandoff: (target: SendToTarget) => SendToPayload | null;
}

export const createHandoffSlice: StateCreator<HandoffSlice> = (set, get) => ({
    pendingHandoffs: {},
    
    sendToModule: (target, payload) => {
        const now = Date.now();
        const targetViews: Record<SendToTarget, string | undefined> = {
            merch: 'design',
            marketing: 'visuals',
            boardroom: 'conversation',
            touring: 'rider',
        };

        const stagedPayload: SendToPayload = {
            ...payload,
            timestamp: payload.timestamp || now,
            targetView: payload.targetView || targetViews[target],
        };

        logger.info(`[HandoffSlice] Initiating handoff to "${target}" for asset: ${stagedPayload.assetId}`);
        
        const current = get().pendingHandoffs[target];
        if (current) {
            const ageMs = now - (current.timestamp || 0);
            if (ageMs < 10 * 60 * 1000) {
                const message = `Replacing an unconsumed ${target} handoff (${current.assetId}) with ${stagedPayload.assetId}.`;
                logger.warn(`[HandoffSlice] ${message}`);
                toast.warning(message);
            }
        }

        set((state) => ({
            pendingHandoffs: {
                ...state.pendingHandoffs,
                [target]: stagedPayload,
            }
        }));
        
        // Switch modules dynamically on root store
        import('@/core/store').then(({ useStore }) => {
            const store = useStore.getState();
            
            // Map target to ModuleId
            const targetModuleMap: Record<SendToTarget, string> = {
                merch: 'merch',
                marketing: 'marketing',
                boardroom: 'dashboard', // Boardroom operates inside dashboard overlay
                touring: 'road'
            };
            
            const destinationModule = targetModuleMap[target];
            if (destinationModule) {
                // Cast to any since TS might not know it is in the root store slice directly
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (store as any).setModule(destinationModule);
                
                // Special boardroom route setup
                if (target === 'boardroom') {
                    // Open the boardroom overlay instantly
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (store as any).addActiveAgent('generalist');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (store as any).setConversationMode('boardroom');
                }
            }
        }).catch(err => logger.error('[HandoffSlice] Routing switch failed:', err));
    },

    peekHandoff: (target) => {
        const { pendingHandoffs } = get();
        const payload = pendingHandoffs[target];
        if (!payload) {
            return null;
        }

        const ageMs = Date.now() - (payload.timestamp || 0);
        if (ageMs > 10 * 60 * 1000) {
            logger.warn(`[HandoffSlice] Expired handoff for "${target}" (${payload.assetId}) after ${Math.round(ageMs / 1000)}s.`);
            return null;
        }

        logger.debug(`[HandoffSlice] Handoff peeked (not yet consumed) by target: "${target}"`);
        return payload;
    },

    consumeHandoff: (target) => {
        const { pendingHandoffs } = get();
        const payload = pendingHandoffs[target];
        if (!payload) {
            return null;
        }

        const ageMs = Date.now() - (payload.timestamp || 0);
        if (ageMs > 10 * 60 * 1000) {
            logger.warn(`[HandoffSlice] Expired handoff for "${target}" (${payload.assetId}) after ${Math.round(ageMs / 1000)}s.`);
            toast.warning(`Expired ${target} handoff "${payload.prompt || payload.assetId}" was discarded.`);
            set((state) => {
                const next = { ...state.pendingHandoffs };
                delete next[target];
                return { pendingHandoffs: next };
            });
            return null;
        }

        set((state) => {
            const next = { ...state.pendingHandoffs };
            delete next[target];
            return { pendingHandoffs: next };
        });
        logger.debug(`[HandoffSlice] Handoff consumed and cleared by target: "${target}"`);
        return payload;
    }
});
