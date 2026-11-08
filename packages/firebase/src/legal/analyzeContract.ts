import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { arcjetKey } from '../config/secrets';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { getVertexAIClient } from '../lib/vertexClient';
import { FUNCTION_INTELLIGENCE_MODELS } from '../config/models';

export interface AnalyzeContractRequest {
    fileData: string;
    mimeType: string;
}

export interface AnalyzeContractResponse {
    score: number;
    summary: string;
    risks: string[];
}

export const analyzeContract = onCall(
    {
        region: 'us-central1',
        timeoutSeconds: 120,
        memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
        secrets: [arcjetKey],
        enforceAppCheck: true,
    },
    async (request): Promise<AnalyzeContractResponse> => {
        validateAppCheckV2(request);
        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'User must be authenticated to analyze contracts.');
        }
        if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
        }
        if (request.auth.token?.email_verified === false) {
            throw new HttpsError('permission-denied', 'Verified email is required.');
        }

        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'verified-free',
                operationId: `analyze-contract:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        const { fileData, mimeType } = (request.data ?? {}) as AnalyzeContractRequest;
        if (!fileData || typeof fileData !== 'string' || !fileData.trim()) {
            throw new HttpsError('invalid-argument', "Missing or invalid 'fileData'.");
        }
        const resolvedMime = typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'text/plain';
        const isBinaryInline = resolvedMime === 'application/pdf';

        const genai = getVertexAIClient();
        const prompt = [
            'You are an entertainment lawyer reviewing a music industry contract.',
            'Return ONLY a JSON object with:',
            '- "score": number from 0 to 100 indicating overall artist safety/fairness,',
            '- "summary": concise 2-3 sentence summary of key terms,',
            '- "risks": array of strings naming concrete risks, perpetuity grants, AI voice/likeness clauses, or missing protections.',
        ].join('\n');

        const parts = isBinaryInline
            ? [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: resolvedMime,
                        data: fileData.includes(',') ? fileData.slice(fileData.indexOf(',') + 1) : fileData,
                    },
                },
            ]
            : [{ text: `${prompt}\n\nContract Content:\n${fileData.slice(0, 30000)}` }];

        const response = await genai.models.generateContent({
            model: FUNCTION_INTELLIGENCE_MODELS.TEXT.FAST,
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: 'application/json',
                temperature: 1.0,
            },
        });

        const rawText = response.text?.trim() ?? '';
        if (!rawText) {
            throw new HttpsError('internal', 'Contract analysis model returned an empty response.');
        }

        try {
            const cleaned = rawText
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/```\s*$/, '')
                .trim();
            const parsed = JSON.parse(cleaned) as Partial<AnalyzeContractResponse>;
            const score = typeof parsed.score === 'number' && Number.isFinite(parsed.score)
                ? Math.max(0, Math.min(100, Math.round(parsed.score)))
                : 50;
            const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
                ? parsed.summary.trim()
                : 'Contract analyzed.';
            const risks = Array.isArray(parsed.risks)
                ? parsed.risks.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
                : [];
            return { score, summary, risks };
        } catch {
            throw new HttpsError('internal', 'Contract analysis model returned malformed JSON.');
        }
    },
);
