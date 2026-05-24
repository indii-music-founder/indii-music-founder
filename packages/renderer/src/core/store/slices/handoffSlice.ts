import { StateCreator } from 'zustand';
import { SendToTarget, SendToPayload } from '@/types/handoff';
import { logger } from '@/utils/logger';

export interface HandoffSlice {
    pendingHandoff: {
        target: SendToTarget;
        payload: SendToPayload;
    } | null;
    
    /** Stages an asset for handoff, triggers routing, and coordinates transitions */
    sendToModule: (target: SendToTarget, payload: SendToPayload) => void;
    
    /** Consumes and clears the pending asset within the target module */
    consumeHandoff: (target: SendToTarget) => SendToPayload | null;
}

export const createHandoffSlice: StateCreator<HandoffSlice> = (set, get) => ({
    pendingHandoff: null,
    
    sendToModule: (target, payload) => {
        logger.info(`[HandoffSlice] Initiating handoff to "${target}" for asset: ${payload.assetId}`);
        
        // Stage the payload
        set({ pendingHandoff: { target, payload } });
        
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
                (store as any).setModule(destinationModule);
                
                // Special boardroom route setup
                if (target === 'boardroom') {
                    // Open the boardroom overlay instantly
                    (store as any).addActiveAgent('generalist');
                }
            }
        }).catch(err => logger.error('[HandoffSlice] Routing switch failed:', err));
    },
    
    consumeHandoff: (target) => {
        const { pendingHandoff } = get();
        if (!pendingHandoff || pendingHandoff.target !== target) {
            return null;
        }
        
        const payload = pendingHandoff.payload;
        set({ pendingHandoff: null }); // Clear instantly to make it atomic
        logger.debug(`[HandoffSlice] Handoff consumed successfully by target: "${target}"`);
        return payload;
    }
});
