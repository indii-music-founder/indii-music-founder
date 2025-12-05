import { useStore } from '@/core/store';

export const AnalysisTools = {
    analyze_audio: async (args: { audio: string }) => {
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
            if (e instanceof Error) {
                return `Audio analysis failed: ${e.message}`;
            }
            return `Audio analysis failed: An unknown error occurred.`;
        }
    },
    analyze_contract: async (args: { file_data: string, mime_type: string }) => {
        try {
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');
            const analyzeContract = httpsCallable(functions, 'analyzeContract');
            const result = await analyzeContract({ fileData: args.file_data, mimeType: args.mime_type });
            const data = result.data as any;
            return `Contract Analysis:\nScore: ${data.score}\nSummary: ${data.summary}\nRisks: ${data.risks.join('\n- ')}`;
        } catch (e: any) {
            return `Contract analysis failed: ${e.message}`;
        }
    },
    search_knowledge: async (args: { query: string }) => {
        try {
            const { runAgenticWorkflow } = await import('@/services/rag/ragService');
            const { useStore } = await import('@/core/store');
            const { userProfile } = useStore.getState();

            const onUpdate = (msg: string) => console.log(`[RAG]: ${msg}`);
            const onDocStatus = () => { };

            const result = await runAgenticWorkflow(args.query, userProfile, null, onUpdate, onDocStatus);
            return `RAG Search Result: ${result.asset.content}`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Knowledge search failed: ${e.message}`;
            }
            return `Knowledge search failed: An unknown error occurred.`;
        }
    },
    verify_output: async (args: { goal: string, content: string }) => {
        try {
            const { AI } = await import('@/services/ai/AIService');
            const prompt = `CRITIQUE REQUEST:
            GOAL: ${args.goal}
            CONTENT: ${args.content}
            
            Evaluate if the content meets the goal. Provide a score (1-10) and specific feedback.`;

            const res = await AI.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text();
        } catch (e: any) {
            return `Verification failed: ${e.message}`;
        }
    }
};
