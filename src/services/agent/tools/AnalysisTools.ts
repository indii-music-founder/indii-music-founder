import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// AnalysisTools Implementation
// ============================================================================

export const AnalysisTools: Record<string, AnyToolFunction> = {
    analyze_audio: wrapTool('analyze_audio', async (args: { audio: string }) => {
        const { AudioAnalysisEngine } = await import('@/modules/music/services/AudioAnalysisEngine');
        const engine = new AudioAnalysisEngine();

        const match = args.audio.match(/^data:(.+);base64,(.+)$/);
        if (!match) {
            return toolError("Invalid audio data. Must be base64 data URI.", "INVALID_INPUT");
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
        return toolSuccess(analysis, `Audio Analysis Result: ${JSON.stringify(analysis, null, 2)}`);
    }),

    analyze_contract: wrapTool('analyze_contract', async (args: { file_data: string, mime_type: string }) => {
        const { functions } = await import('@/services/firebase');
        const { httpsCallable } = await import('firebase/functions');
        const analyzeContract = httpsCallable<
            { fileData: string; mimeType: string },
            { score?: number, summary?: string, risks?: string[] }
        >(functions, 'analyzeContract');

        const result = await analyzeContract({ fileData: args.file_data, mimeType: args.mime_type });
        const data = result.data;

        const risks = data.risks ?? [];
        return toolSuccess(data, `Contract Analysis:\nScore: ${data.score ?? 'N/A'}\nSummary: ${data.summary ?? 'N/A'}\nRisks:\n- ${risks.join('\n- ')}`);
    })
};
