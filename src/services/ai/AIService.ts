import { GenAI } from './GenAI';
import type { GenerateContentResult } from 'firebase/ai';
import type { Content, GenerationConfig, Tool, SafetySetting, ToolConfig } from '@/shared/types/ai.dto';
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
    ): Promise<any> {
        console.warn('[indiiOS:DEPRECATED] AIService.generateContent is deprecated. Use GenAI.generateContent instead.');

        let p_contents: any;
        let p_model: string | undefined = modelOverride;
        let p_config: any = config;
        let p_systemInstruction: string | undefined = systemInstruction;
        let p_tools: any[] | undefined = tools;
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

        // 1. Check if already aborted
        if (p_signal?.aborted) {
            throw new AppException(AppErrorCode.CANCELLED, 'AI Request was cancelled by user');
        }

        // 2. Implement Timeout Logic
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
            // [LEGACY-COMPAT] Matching exact option structure for strict toHaveBeenCalledWith tests
            const exactOptions: any = {
                ...options,
                signal: internalSignal,
                safetySettings: options?.safetySettings,
                toolConfig: options?.toolConfig
            };

            const resultPromise = GenAI.generateContent(
                p_contents as any,
                p_model as any,
                p_config as any,
                p_systemInstruction as any,
                p_tools as any, // Cast: ai.dto.Tool → firebase/ai.Tool structural equivalence
                exactOptions
            );

            // 3. Race against timeout
            const result = await Promise.race([resultPromise, timeoutPromise]) as any;

            if (timeoutId) clearTimeout(timeoutId);

            if (p_signal?.aborted) {
                throw new AppException(AppErrorCode.CANCELLED, 'AI Request was cancelled by user');
            }

            // [COMPAT] Return the response directly to match legacy AIService behavior
            const response = result.response;
            if (response && !response.text) {
                (response as any).text = function () {
                    return this.candidates?.[0]?.content?.parts?.[0]?.text || '';
                };
            }
            return response;
        } catch (error: any) {
            if (timeoutId) clearTimeout(timeoutId);

            // Handle Cancellation explicitly for tests
            if (error.name === 'AbortError' || (p_signal?.aborted && (!error.code || error.code === AppErrorCode.CANCELLED))) {
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
    ): Promise<any> {
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

        let p_contents: any;
        let p_model: string | undefined = modelOverride;
        let p_config: any = config;
        let p_systemInstruction: string | undefined = systemInstruction;
        let p_tools: any[] | undefined = tools;
        let p_options: any = options;

        if (typeof promptOrOptions === 'object' && !Array.isArray(promptOrOptions) && (promptOrOptions as any).contents) {
            const opts = promptOrOptions as any;
            p_contents = opts.contents;
            p_model = opts.model || modelOverride;
            p_config = opts.config || config;
            p_systemInstruction = opts.systemInstruction || systemInstruction;
            p_tools = opts.tools || tools;
            p_options = { ...options, signal: opts.signal || options?.signal };
        } else {
            p_contents = promptOrOptions;
        }

        return GenAI.generateContentStream(p_contents, p_model, p_config, p_systemInstruction, p_tools, p_options);
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
        return (GenAI as any).generateText(prompt, maxTokens, systemInstruction);
    }

    static async generateText(prompt: string, maxTokens?: number, systemInstruction?: string): Promise<string> {
        return new AIService().generateText(prompt, maxTokens, systemInstruction);
    }

    // Legacy method generateStructuredData
    async generateStructuredData(prompt: string, schema: any, maxTokens?: number, systemInstruction?: string): Promise<any> {
        return (GenAI as any).generateStructuredData(prompt, schema, maxTokens, systemInstruction);
    }

    static async generateStructuredData(prompt: string, schema: any, maxTokens?: number, systemInstruction?: string): Promise<any> {
        return new AIService().generateStructuredData(prompt, schema, maxTokens, systemInstruction);
    }
}

export const AI = AIService;
export default AIService;
