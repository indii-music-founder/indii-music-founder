
import { auth } from '@/services/firebase';
import { livingFileService } from '../living/LivingFileService';
import { ModelRouter } from '../router/ModelRouter';
import { AI } from '@/services/ai/AIService';
import { agentService } from '../AgentService';
// We'll use a type-only import for ProactiveTask to avoid potential circular deps if we were syncing states
import type { ProactiveTask } from '../types';

export class PulseEngine {
    private readonly PULSE_INTERVAL = 30 * 60 * 1000; // 30 minutes
    private pulseTimer: NodeJS.Timeout | null = null;
    private isRunning = false;

    start() {
        if (this.isRunning) return;

        console.info('[PulseEngine] Starting Studio Pulse...');
        this.isRunning = true;

        // Initial pulse after 5 seconds
        setTimeout(() => this.firePulse(), 5000);

        // Interval pulse
        this.pulseTimer = setInterval(() => this.firePulse(), this.PULSE_INTERVAL);
    }

    stop() {
        if (this.pulseTimer) {
            clearInterval(this.pulseTimer);
            this.pulseTimer = null;
        }
        this.isRunning = false;
        console.info('[PulseEngine] Studio Pulse stopped.');
    }

    /**
     * The Heartbeat: Checks if the agent needs to wake up.
     * Uses Flash (via ModelRouter) for negligible cost.
     */
    async firePulse() {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            console.debug('[PulseEngine] No user authenticated, skipping pulse.');
            return;
        }

        try {
            console.debug('[PulseEngine] Firing pulse check...');

            // 1. Read the lean Pulse Checklist
            const pulseChecklist = await livingFileService.read(userId, 'PULSE');

            // Get session noise level (history length)
            const { useStore } = await import('@/core/store');
            const historyLength = useStore.getState().agentHistory.length;

            // 2. Use CHEAP model to triage
            const result = await AI.generateContent({
                model: ModelRouter.select('triage'),
                contents: {
                    role: 'user',
                    parts: [{
                        text: `
                        You are the Studio Pulse monitor. 
                        Read this checklist and determine if any items need immediate action for the user.
                        
                        CHECKLIST:
                        ${pulseChecklist}
                        
                        CURRENT TIME: ${new Date().toISOString()}
                        SESSION NOISE LEVEL: ${historyLength} messages
                        
                        INSTRUCTIONS:
                        - Only trigger if something is URGENT or scheduled.
                        - If SESSION NOISE LEVEL > 50, recommend 'compact_history' as the instruction.
                        - Do not trigger just to say "hello".
                        - Keep reasons concise.
                        
                        Respond with JSON:
                        { "actionNeeded": boolean, "reason": "why", "instruction": "what to do" }
                        
                        If nothing is urgent and noise is low, respond with:
                        { "actionNeeded": false, "reason": "PULSE_OK" }
                    `}]
                },
                config: { responseMimeType: 'application/json' }
            });

            const decisionText = result.text() || '{}';
            const decision = JSON.parse(decisionText);

            if (decision.actionNeeded) {
                console.info(`[PulseEngine] ❤️ Pulse Action Triggered: ${decision.reason}`);

                // 3. Wake the EXPENSIVE model only if needed
                await agentService.runAgent('generalist', decision.instruction, {
                    traceId: `pulse-${Date.now()}`,
                    triggerType: 'schedule' // using 'schedule' as proxy for heartbeat in existing types
                });
            } else {
                console.debug('[PulseEngine] PULSE_OK — all clear');
            }

        } catch (error) {
            console.error('[PulseEngine] Failed to fire pulse:', error);
        }
    }
}

export const pulseEngine = new PulseEngine();
