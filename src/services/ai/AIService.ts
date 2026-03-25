/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
import { GenAI } from './GenAI';
import { logger } from '@/utils/logger';
import { GenerateContentOptions, GenerateContentResponse } from '@/shared/types/ai.dto';

/**
 * @deprecated Use GenAI instead. 
 * AIService has been merged into FirebaseAIService and is now exposed via the GenAI facade.
 * This file remains for backward compatibility during the transition.
 */
export class AIService {
    private static instance: AIService;

    private constructor() {
        logger.warn('[AIService] Legacy AIService accessed. Please migrate to GenAI.');
    }

    public static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /** @deprecated Use GenAI.generateText */
    async generateContent(prompt: string, modelOverride?: string): Promise<string> {
        return GenAI.generateText(prompt, modelOverride);
    }

    /** @deprecated Use GenAI.generateStructuredData */
    async generateStructuredData<T>(options: GenerateContentOptions): Promise<T> {
        return GenAI.generateStructuredData<T>(options);
    }

    /** @deprecated Use GenAI.chat */
    async chat(history: any[], newMessage: string, systemInstruction?: string): Promise<string> {
        return GenAI.chat(history, newMessage, systemInstruction);
    }
}

/** @deprecated Use GenAI instead */
export const aiService = AIService.getInstance();
