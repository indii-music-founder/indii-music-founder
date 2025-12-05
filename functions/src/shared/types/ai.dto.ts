export interface GenerateContentRequest {
    model: string;
    contents: { role: string; parts: any[] } | { role: string; parts: any[] }[];
    config?: Record<string, unknown>;
}

export interface GenerateContentResponse {
    candidates?: {
        content: {
            parts: {
                text?: string;
                functionCall?: any;
            }[];
        };
    }[];
    [key: string]: any;
}

export interface GenerateVideoRequest {
    model: string;
    prompt: string;
    image?: { imageBytes: string; mimeType: string };
    config?: Record<string, unknown>;
}

export interface GenerateVideoResponse {
    predictions?: any[];
    [key: string]: any;
}
