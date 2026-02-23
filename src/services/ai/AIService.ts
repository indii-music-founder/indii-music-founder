import { GenAI } from './GenAI';
import type { GenerateContentResult, Content, GenerationConfig, Tool, SafetySetting, ToolConfig } from '@google/generative-ai';
import { AppErrorCode, AppException } from '@/shared/types/errors';

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

        let p_contents: any;
        let p_model: string | undefined = modelOverride;
        let p_config: GenerationConfig | undefined = config;
        let p_systemInstruction: string | undefined = systemInstruction;
        let p_tools: Tool[] | undefined = tools;
        let p_signal: AbortSignal | undefined = options?.signal;
        let p_timeout: number | undefined;

        if (typeof promptOrOptions === 'object' && !Array.isArray(promptOrOptions) && (promptOrOptions as any).contents) {
            const opts = promptOrOptions as any;
            p_contents = opts.contents;
            p_model = opts.model || modelOverride;
            p_config = opts.config || config;
            p_systemInstruction = opts.systemInstruction || systemInstruction;
            p_tools = opts.tools || tools;
            p_signal = opts.signal || options?.signal;
            p_timeout = opts.timeout;
        } else {
            p_contents = promptOrOptions;
        }

        // Implement Timeout Logic
        let timeoutId: any;
        const controller = new AbortController();
        const internalSignal = controller.signal;

        if (p_signal) {
            p_signal.addEventListener('abort', () => controller.abort());
        }

        const timeoutPromise = new Promise<never>((_, reject) => {
            if (p_timeout && p_timeout > 0) {
                timeoutId = setTimeout(() => {
                    controller.abort();
                    reject(new AppException(AppErrorCode.TIMEOUT, `AI Request timed out after ${p_timeout}ms`));
                }, p_timeout);
            }
        });

        try {
            const resultPromise = GenAI.generateContent(
                p_contents,
                p_model,
                p_config,
                p_systemInstruction,
                p_tools,
                { ...options, signal: internalSignal }
            );

            const result = await Promise.race([resultPromise, timeoutPromise]) as GenerateContentResult;
            if (timeoutId) clearTimeout(timeoutId);
            return result;
        } catch (error: any) {
            if (timeoutId) clearTimeout(timeoutId);

            // Handle Cancellation explicitly for tests
            if (error.name === 'AbortError' || (p_signal?.aborted && !error.code)) {
                throw new AppException(AppErrorCode.CANCELLED, 'AI Request was cancelled by user');
            }
            throw error;
        }
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
        promptOrOptions: any,
        modelOverride?: string,
        config?: any,
        systemInstruction?: string,
        tools?: any[],
        options?: any
    ) {
        console.warn('[indiiOS:DEPRECATED] AIService.generateContentStream is deprecated. Use GenAI.generateContentStream instead.');

        if (typeof promptOrOptions === 'object' && !Array.isArray(promptOrOptions) && (promptOrOptions as any).contents) {
            const opts = promptOrOptions as any;
            return GenAI.generateContentStream(
                opts.contents,
                opts.model || modelOverride,
                opts.config || config,
                opts.systemInstruction || systemInstruction,
                opts.tools || tools,
                { ...options, signal: opts.signal || options?.signal }
            );
        }

        return GenAI.generateContentStream(promptOrOptions, modelOverride, config, systemInstruction, tools, options);
    }

    static async generateContentStream(
        prompt: any,
        modelOverride?: string,
        config?: any,
        systemInstruction?: string,
        tools?: any[],
        options?: any
    ) {
        return new AIService().generateContentStream(prompt, modelOverride, config, systemInstruction, tools, options);
    }

    // Legacy method generateText
    async generateText(prompt: string, maxTokens?: number, systemInstruction?: string): Promise<string> {
        return GenAI.generateText(prompt, maxTokens, systemInstruction);
    }

    static async generateText(prompt: string, maxTokens?: number, systemInstruction?: string): Promise<string> {
        return new AIService().generateText(prompt, maxTokens, systemInstruction);
    }

    // Legacy method generateStructuredData
    async generateStructuredData(prompt: string, schema: any, maxTokens?: number, systemInstruction?: string): Promise<any> {
        return GenAI.generateStructuredData(prompt, schema, maxTokens, systemInstruction);
    }

    static async generateStructuredData(prompt: string, schema: any, maxTokens?: number, systemInstruction?: string): Promise<any> {
        return new AIService().generateStructuredData(prompt, schema, maxTokens, systemInstruction);
    }
}

export const AI = AIService;
export default AIService;
