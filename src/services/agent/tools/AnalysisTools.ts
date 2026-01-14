import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// AnalysisTools Implementation
// ============================================================================

export const AnalysisTools: Record<string, AnyToolFunction> = {
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
