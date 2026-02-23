import { GenAI } from './GenAI';
import type { GenerateContentResult, Content, GenerationConfig, Tool, SafetySetting, ToolConfig } from '@google/generative-ai';

/**
 * @deprecated Use GenAI instead. This is a compatibility wrapper for legacy code and tests.
 */
export class AIService {
    /**
     * Legacy generateContent supporting both positional and object-based parameters.
     */
    async generateContent(
        promptOrOptions: string | Content[] | { model?: string, contents: any, timeout?: number, signal?: AbortSignal, config?: GenerationConfig, systemInstruction?: string, tools?: Tool[] },
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal, safetySettings?: SafetySetting[], toolConfig?: ToolConfig, thoughtSignature?: string }
    ): Promise<GenerateContentResult> {
        console.warn('[indiiOS:DEPRECATED] AIService.generateContent is deprecated. Use GenAI.generateContent instead.');

        if (typeof promptOrOptions === 'object' && !Array.isArray(promptOrOptions) && (promptOrOptions as any).contents) {
            const opts = promptOrOptions as any;
            return GenAI.generateContent(
                opts.contents,
                opts.model || modelOverride,
                opts.config || config,
                opts.systemInstruction || systemInstruction,
                opts.tools || tools,
                { signal: opts.signal || options?.signal, ...options }
            );
        }

        return GenAI.generateContent(promptOrOptions as any, modelOverride, config, systemInstruction, tools, options);
    }

    /**
     * Static wrapper for convenience.
     */
    static async generateContent(
        prompt: any,
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: any
    ): Promise<GenerateContentResult> {
        return new AIService().generateContent(prompt, modelOverride, config, systemInstruction, tools, options);
    }

    async generateContentStream(
        prompt: any,
        modelOverride?: string,
        config?: any,
        systemInstruction?: string,
        tools?: any[],
        options?: any
    ) {
        console.warn('[indiiOS:DEPRECATED] AIService.generateContentStream is deprecated. Use GenAI.generateContentStream instead.');
        return GenAI.generateContentStream(prompt, modelOverride, config, systemInstruction, tools, options);
    }
}

export const AI = AIService;
export default AIService;
