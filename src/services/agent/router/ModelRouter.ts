
import { AI_MODELS } from '@/core/config/ai-models';

/**
 * Model Router
 * 
 * Strategically selects the most cost-effective AI model for a given task type.
 * Based on the Autonomy Engine Blueprint (v1.0.0).
 * 
 * Logic:
 * - 'triage': Use Flash (cheap, fast) for heartbeats and initial checks.
 * - 'execute': Use Pro (reasoning) for complex agent work.
 * - 'create': Use Pro Image (generation) for creative assets.
 * - 'analyze': Use Flash (cheap) for data/audio analysis logs.
 */
export const ModelRouter = {
    select(taskType: 'triage' | 'execute' | 'create' | 'analyze' | 'code' | 'general'): string {
        switch (taskType) {
            case 'triage':
                // Highly efficient (~$0.10/1M input)
                return AI_MODELS.TEXT.FAST;

            case 'execute':
            case 'code':
            case 'general':
                // High reasoning (~$2.50/1M input)
                return AI_MODELS.TEXT.AGENT;

            case 'create':
                // Generative Image
                return AI_MODELS.IMAGE.GENERATION;

            case 'analyze':
                // Use Flash for reading large logs/audio data unless depth is needed
                return AI_MODELS.TEXT.FAST;

            default:
                return AI_MODELS.TEXT.AGENT;
        }
    }
};
