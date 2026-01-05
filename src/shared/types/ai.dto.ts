// ============================================================================
// Content Part Types (Gemini SDK compatible)
// ============================================================================

export interface TextPart {
    text: string;
}

export interface InlineDataPart {
    inlineData: {
        mimeType: string;
        data: string;
    };
}

export interface FunctionCallPart {
    functionCall: {
        name: string;
        args: Record<string, unknown>;
    };
}

export interface FunctionResponsePart {
    functionResponse: {
        name: string;
        response: Record<string, unknown>;
    };
}

export type ContentPart = TextPart | InlineDataPart | FunctionCallPart | FunctionResponsePart;

export interface Content {
    role: 'user' | 'model' | 'system' | 'function';
    parts: ContentPart[];
}

// ============================================================================
// Tool/Function Declaration Types
// ============================================================================

export interface FunctionDeclarationSchema {
    type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
    description?: string;
    enum?: string[];
    items?: FunctionDeclarationSchema;
    properties?: Record<string, FunctionDeclarationSchema>;
    required?: string[];
}

export interface FunctionDeclaration {
    name: string;
    description?: string;
    parameters?: FunctionDeclarationSchema;
}

export interface ToolConfig {
    functionDeclarations: FunctionDeclaration[];
}

// ============================================================================
// Generation Config Types
// ============================================================================

export interface ThinkingConfig {
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    includeThoughts?: boolean;
    thinkingBudget?: number;
}

export interface ImageConfig {
    imageSize?: '1K' | '2K' | '4K' | string;
}

export interface PrebuiltVoiceConfig {
    voiceName: string;
}

export interface VoiceConfig {
    prebuiltVoiceConfig?: PrebuiltVoiceConfig;
}

export interface SpeechConfig {
    voiceConfig?: VoiceConfig;
}

export interface GenerationConfig {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    candidateCount?: number;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
    // Extended SDK properties
    thinkingConfig?: ThinkingConfig;
    imageConfig?: ImageConfig;
    speechConfig?: SpeechConfig;
    responseModalities?: ('TEXT' | 'IMAGE' | 'AUDIO')[];
    systemInstruction?: string;
    tools?: ToolConfig[];
    // Image generation specific
    sampleCount?: number;
    numberOfImages?: number;
    aspectRatio?: string;
    negativePrompt?: string;
    // Video generation specific
    numberOfVideos?: number;
    durationSeconds?: number;
    lastFrame?: string | { mimeType: string; imageBytes: string };
}

export interface SafetySetting {
    category: string;
    threshold: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface GenerateContentRequest {
    model: string;
    contents: Content | Content[];
    config?: GenerationConfig;
    systemInstruction?: string;
    tools?: ToolConfig[];
    safetySettings?: SafetySetting[];
    apiKey?: string;
}

export interface GenerateVideoRequest {
    model: string;
    prompt: string;
    image?: { imageBytes: string; mimeType: string };
    config?: GenerationConfig & {
        aspectRatio?: string;
        durationSeconds?: number;
    };
    apiKey?: string;
    jobId?: string;
}

export interface GenerateImageRequest {
    model: string;
    prompt: string;
    config?: GenerationConfig & {
        numberOfImages?: number;
        aspectRatio?: string;
        negativePrompt?: string;
    };
    apiKey?: string;
}

export interface EmbedContentRequest {
    model: string;
    content: Content;
    apiKey?: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface SafetyRating {
    category: string;
    probability: string;
    blocked?: boolean;
}

export interface CitationSource {
    startIndex?: number;
    endIndex?: number;
    uri?: string;
    license?: string;
}

export interface CitationMetadata {
    citationSources: CitationSource[];
}

export interface Candidate {
    content: {
        role: string;
        parts: ContentPart[];
    };
    finishReason?: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
    safetyRatings?: SafetyRating[];
    citationMetadata?: CitationMetadata;
    index?: number;
}

export interface PromptFeedback {
    blockReason?: string;
    safetyRatings?: SafetyRating[];
}

export interface UsageMetadata {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
}

export interface GenerateContentResponse {
    candidates?: Candidate[];
    promptFeedback?: PromptFeedback;
    usageMetadata?: UsageMetadata;
}

export interface VideoPrediction {
    video?: string;
    mimeType?: string;
    bytesBase64Encoded?: string;
}

export interface GenerateVideoResponse {
    predictions?: VideoPrediction[];
    metadata?: {
        operationName?: string;
    };
}

export interface GeneratedImage {
    bytesBase64Encoded: string;
    mimeType: string;
}

export interface GenerateImageResponse {
    images: GeneratedImage[];
    metadata?: {
        modelVersion?: string;
    };
}

export interface AudioPart {
    inlineData: {
        mimeType: string;
        data: string; // base64
    };
}

export interface GenerateSpeechResponse {
    audio: AudioPart;
}

export interface EmbedContentResponse {
    embedding: {
        values: number[];
    };
}

// ============================================================================
// Wrapped Response Type (for SDK compatibility layer)
// ============================================================================

export interface WrappedResponse {
    response: GenerateContentResponse;
    text: () => string;
    functionCalls: () => FunctionCallPart['functionCall'][];
}

// ============================================================================
// Type Guards for ContentPart Union
// ============================================================================

export function isTextPart(part: ContentPart): part is TextPart {
    return 'text' in part;
}

export function isInlineDataPart(part: ContentPart): part is InlineDataPart {
    return 'inlineData' in part;
}

export function isFunctionCallPart(part: ContentPart): part is FunctionCallPart {
    return 'functionCall' in part;
}


export function isFunctionResponsePart(part: ContentPart): part is FunctionResponsePart {
    return 'functionResponse' in part;
}

// ============================================================================
// Service Options (Moved from AIService to prevent cycles)
// ============================================================================

export interface GenerateContentOptions {
    model?: string;
    contents?: Content | Content[];
    config?: GenerationConfig;
    systemInstruction?: string;
    tools?: ToolConfig[];
    signal?: AbortSignal;
    timeout?: number;
    // Caching options
    skipCache?: boolean;
    cache?: boolean;
    cacheTTL?: number;
}

export interface GenerateStreamOptions {
    model: string;
    contents: Content[];
    config?: GenerationConfig;
    systemInstruction?: string;
    tools?: ToolConfig[];
}

export interface GenerateVideoOptions {
    model: string;
    prompt: string;
    image?: { imageBytes: string; mimeType: string };
    config?: GenerationConfig & {
        aspectRatio?: string;
        durationSeconds?: number;
    };
    /** Custom timeout in milliseconds. Defaults to calculated based on durationSeconds or 2 minutes minimum. */
    timeoutMs?: number;
}

export interface GenerateImageOptions {
    model: string;
    prompt: string;
    config?: GenerationConfig & {
        numberOfImages?: number;
        aspectRatio?: string;
        negativePrompt?: string;
    };
}

export interface EmbedContentOptions {
    model: string;
    content: Content;
}

export interface StreamChunk {
    text: () => string;
    functionCalls: () => FunctionCallPart['functionCall'][];
}

export interface RetryableError extends Error {
    code?: string;
}
