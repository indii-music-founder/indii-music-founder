export interface NormalizedEditImageResult {
    id: string;
    url: string;
    prompt: string;
    thoughtSignature?: string;
    storageUri?: string;
}

type CandidatePart = {
    text?: string;
    inlineData?: {
        mimeType?: string;
        data?: string;
    };
    thought_signature?: string;
    thoughtSignature?: string;
};

type CandidateResponse = {
    id?: string;
    url?: string;
    prompt?: string;
    thoughtSignature?: string;
    storageUri?: string;
    candidates?: Array<{
        content?: {
            parts?: CandidatePart[];
        };
    }>;
};

function toDataUrl(mimeType: string, data: string): string {
    return `data:${mimeType};base64,${data}`;
}

export function normalizeEditImageResult(result: unknown, fallbackPrompt: string): NormalizedEditImageResult | null {
    if (!result || typeof result !== 'object') {
        return null;
    }

    const typed = result as CandidateResponse;
    const fallbackId = crypto.randomUUID();
    const prompt = typeof typed.prompt === 'string' && typed.prompt.trim().length > 0
        ? typed.prompt
        : fallbackPrompt;

    if (typeof typed.url === 'string' && typed.url.trim().length > 0) {
        return {
            id: typeof typed.id === 'string' && typed.id.trim().length > 0 ? typed.id : fallbackId,
            url: typed.url,
            prompt,
            thoughtSignature: typed.thoughtSignature,
            storageUri: typeof typed.storageUri === 'string' && typed.storageUri.trim().length > 0 ? typed.storageUri : undefined,
        };
    }

    for (const candidate of typed.candidates || []) {
        const parts = candidate.content?.parts || [];
        const imagePart = [...parts].reverse().find((part) => {
            const data = part.inlineData?.data;
            return typeof data === 'string' && data.trim().length > 0;
        });

        if (imagePart?.inlineData?.data) {
            const mimeType = imagePart.inlineData.mimeType || 'image/png';
            const thoughtSignature = imagePart.thought_signature || imagePart.thoughtSignature || typed.thoughtSignature;

            return {
                id: typeof typed.id === 'string' && typed.id.trim().length > 0 ? typed.id : fallbackId,
                url: toDataUrl(mimeType, imagePart.inlineData.data),
                prompt,
                thoughtSignature,
            };
        }
    }

    return null;
}
