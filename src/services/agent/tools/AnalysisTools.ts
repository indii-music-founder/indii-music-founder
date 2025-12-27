import type { ToolFunctionArgs } from '../types';
import { AI_MODELS } from '@/core/config/ai-models';

// ============================================================================
// Types for AnalysisTools
// ============================================================================

interface AnalyzeAudioArgs extends ToolFunctionArgs {
    audio: string;
}

interface AnalyzeContractArgs extends ToolFunctionArgs {
    file_data: string;
    mime_type: string;
}

// Note: search_knowledge moved to KnowledgeTools

interface VerifyOutputArgs extends ToolFunctionArgs {
    goal: string;
    content: string;
}

interface ContractAnalysisResult {
    score?: number;
    summary?: string;
    risks?: string[];
}

// ============================================================================
// Helper to extract error message
// ============================================================================

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}

// ============================================================================
// AnalysisTools Implementation
// ============================================================================

export const AnalysisTools = {
    analyze_audio: async (args: AnalyzeAudioArgs): Promise<string> => {
        try {
            const { AudioAnalysisEngine } = await import('@/modules/music/services/AudioAnalysisEngine');
            const engine = new AudioAnalysisEngine();

            const match = args.audio.match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                return "Invalid audio data. Must be base64 data URI.";
            }

            const base64Data = match[2];
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            const analysis = await engine.analyze(arrayBuffer);
            return `Audio Analysis Result: ${JSON.stringify(analysis, null, 2)}`;
        } catch (e: unknown) {
            return `Audio analysis failed: ${getErrorMessage(e)}`;
        }
    },

    analyze_contract: async (args: AnalyzeContractArgs): Promise<string> => {
        try {
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');
            const analyzeContract = httpsCallable<
                { fileData: string; mimeType: string },
                ContractAnalysisResult
            >(functions, 'analyzeContract');

            const result = await analyzeContract({ fileData: args.file_data, mimeType: args.mime_type });
            const data = result.data;

            const risks = data.risks ?? [];
            return `Contract Analysis:\nScore: ${data.score ?? 'N/A'}\nSummary: ${data.summary ?? 'N/A'}\nRisks: ${risks.join('\n- ')}`;
        } catch (e: unknown) {
            return `Contract analysis failed: ${getErrorMessage(e)}`;
        }
    },

    // Note: search_knowledge moved to KnowledgeTools

    verify_output: async (args: VerifyOutputArgs): Promise<string> => {
        try {
            const { AI } = await import('@/services/ai/AIService');
            const prompt = `CRITIQUE REQUEST:
            GOAL: ${args.goal}
            CONTENT: ${args.content}

            Evaluate if the content meets the goal. Provide a score (1-10) and specific feedback.`;

            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text();
        } catch (e: unknown) {
            return `Verification failed: ${getErrorMessage(e)}`;
        }
    }
};
