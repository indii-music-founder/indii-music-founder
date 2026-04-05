/**
 * Safety settings for AI model generation.
 * Enforces strict content safety policies for the IndiiOS ecosystem.
 */
import { SafetySetting } from '@/shared/types/ai.dto';

// Standard Harm Categories (mapped to strings to avoid SDK import issues)
export const HARM_CATEGORY = {
    HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT'
} as const;

// Standard Block Thresholds
export const HARM_BLOCK_THRESHOLD = {
    BLOCK_NONE: 'BLOCK_NONE',
    BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
    BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH'
} as const;

export const STANDARD_SAFETY_SETTINGS: SafetySetting[] = [
    {
        category: HARM_CATEGORY.HARASSMENT,
        threshold: HARM_BLOCK_THRESHOLD.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        category: HARM_CATEGORY.HATE_SPEECH,
        threshold: HARM_BLOCK_THRESHOLD.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        category: HARM_CATEGORY.SEXUALLY_EXPLICIT,
        threshold: HARM_BLOCK_THRESHOLD.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        category: HARM_CATEGORY.DANGEROUS_CONTENT,
        threshold: HARM_BLOCK_THRESHOLD.BLOCK_MEDIUM_AND_ABOVE
    }
];
