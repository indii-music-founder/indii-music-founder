import { z } from 'zod';
export declare const KNOWLEDGE_DOCUMENT_STATE_SCHEMA: z.ZodEnum<["uploading", "uploaded", "verifying", "queued", "indexing", "active", "failed", "deleting", "deleted"]>;
export type KnowledgeDocumentState = z.infer<typeof KNOWLEDGE_DOCUMENT_STATE_SCHEMA>;
export declare const KNOWLEDGE_WORKER_VERSION: "v1.0.0";
export declare const KNOWLEDGE_EMBEDDING_MODEL: "text-embedding-004";
export declare const KNOWLEDGE_EMBEDDING_DIMENSION: 768;
export declare const KnowledgeDocumentSchema: z.ZodObject<{
    id: z.ZodString;
    uid: z.ZodString;
    contentSha256: z.ZodString;
    storagePath: z.ZodString;
    storageGeneration: z.ZodString;
    title: z.ZodString;
    mimeType: z.ZodEnum<["text/plain", "text/markdown", "application/pdf"]>;
    byteSize: z.ZodNumber;
    state: z.ZodEnum<["uploading", "uploaded", "verifying", "queued", "indexing", "active", "failed", "deleting", "deleted"]>;
    workerVersion: z.ZodDefault<z.ZodString>;
    embeddingModel: z.ZodDefault<z.ZodString>;
    embeddingDimension: z.ZodDefault<z.ZodNumber>;
    chunkCount: z.ZodDefault<z.ZodNumber>;
    failureReason: z.ZodOptional<z.ZodString>;
    failureCode: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    indexedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    mimeType: "text/plain" | "text/markdown" | "application/pdf";
    byteSize: number;
    workerVersion: string;
    storagePath: string;
    uid: string;
    contentSha256: string;
    storageGeneration: string;
    state: "failed" | "queued" | "uploading" | "uploaded" | "verifying" | "indexing" | "active" | "deleting" | "deleted";
    embeddingModel: string;
    embeddingDimension: number;
    chunkCount: number;
    failureReason?: string | undefined;
    failureCode?: string | undefined;
    indexedAt?: string | null | undefined;
}, {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    mimeType: "text/plain" | "text/markdown" | "application/pdf";
    byteSize: number;
    storagePath: string;
    uid: string;
    contentSha256: string;
    storageGeneration: string;
    state: "failed" | "queued" | "uploading" | "uploaded" | "verifying" | "indexing" | "active" | "deleting" | "deleted";
    workerVersion?: string | undefined;
    embeddingModel?: string | undefined;
    embeddingDimension?: number | undefined;
    chunkCount?: number | undefined;
    failureReason?: string | undefined;
    failureCode?: string | undefined;
    indexedAt?: string | null | undefined;
}>;
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
export declare const KnowledgeChunkSchema: z.ZodObject<{
    chunkId: z.ZodString;
    documentId: z.ZodString;
    uid: z.ZodString;
    ordinal: z.ZodNumber;
    text: z.ZodString;
    startOffset: z.ZodNumber;
    endOffset: z.ZodNumber;
    pageNumber: z.ZodOptional<z.ZodNumber>;
    embedding: z.ZodArray<z.ZodNumber, "many">;
    embeddingModel: z.ZodDefault<z.ZodString>;
    chunkHash: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    uid: string;
    embeddingModel: string;
    chunkId: string;
    documentId: string;
    ordinal: number;
    text: string;
    startOffset: number;
    endOffset: number;
    embedding: number[];
    chunkHash: string;
    pageNumber?: number | undefined;
}, {
    createdAt: string;
    uid: string;
    chunkId: string;
    documentId: string;
    ordinal: number;
    text: string;
    startOffset: number;
    endOffset: number;
    embedding: number[];
    chunkHash: string;
    embeddingModel?: string | undefined;
    pageNumber?: number | undefined;
}>;
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;
export declare const KnowledgeIndexReceiptSchema: z.ZodObject<{
    receiptId: z.ZodString;
    documentId: z.ZodString;
    uid: z.ZodString;
    contentSha256: z.ZodString;
    storageGeneration: z.ZodString;
    workerVersion: z.ZodString;
    embeddingModel: z.ZodString;
    embeddingDimension: z.ZodNumber;
    chunkCount: z.ZodNumber;
    status: z.ZodEnum<["success", "failed"]>;
    failureCode: z.ZodOptional<z.ZodString>;
    failureReason: z.ZodOptional<z.ZodString>;
    indexedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "success";
    workerVersion: string;
    receiptId: string;
    uid: string;
    contentSha256: string;
    storageGeneration: string;
    embeddingModel: string;
    embeddingDimension: number;
    chunkCount: number;
    indexedAt: string;
    documentId: string;
    failureReason?: string | undefined;
    failureCode?: string | undefined;
}, {
    status: "failed" | "success";
    workerVersion: string;
    receiptId: string;
    uid: string;
    contentSha256: string;
    storageGeneration: string;
    embeddingModel: string;
    embeddingDimension: number;
    chunkCount: number;
    indexedAt: string;
    documentId: string;
    failureReason?: string | undefined;
    failureCode?: string | undefined;
}>;
export type KnowledgeIndexReceipt = z.infer<typeof KnowledgeIndexReceiptSchema>;
export declare const KnowledgeQueryRequestSchema: z.ZodObject<{
    query: z.ZodString;
    documentIdFilters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    topK: z.ZodDefault<z.ZodNumber>;
    minRelevance: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    topK: number;
    minRelevance: number;
    documentIdFilters?: string[] | undefined;
}, {
    query: string;
    documentIdFilters?: string[] | undefined;
    topK?: number | undefined;
    minRelevance?: number | undefined;
}>;
export type KnowledgeQueryRequest = z.infer<typeof KnowledgeQueryRequestSchema>;
export declare const KnowledgeCitationSchema: z.ZodObject<{
    documentId: z.ZodString;
    documentTitle: z.ZodString;
    pageNumber: z.ZodOptional<z.ZodNumber>;
    startOffset: z.ZodNumber;
    endOffset: z.ZodNumber;
    relevanceScore: z.ZodNumber;
    snippet: z.ZodString;
}, "strip", z.ZodTypeAny, {
    documentId: string;
    startOffset: number;
    endOffset: number;
    documentTitle: string;
    relevanceScore: number;
    snippet: string;
    pageNumber?: number | undefined;
}, {
    documentId: string;
    startOffset: number;
    endOffset: number;
    documentTitle: string;
    relevanceScore: number;
    snippet: string;
    pageNumber?: number | undefined;
}>;
export type KnowledgeCitation = z.infer<typeof KnowledgeCitationSchema>;
export declare const KnowledgeQueryReceiptSchema: z.ZodObject<{
    queryId: z.ZodString;
    uid: z.ZodString;
    queryText: z.ZodString;
    durationMs: z.ZodNumber;
    resultCount: z.ZodNumber;
    citations: z.ZodArray<z.ZodObject<{
        documentId: z.ZodString;
        documentTitle: z.ZodString;
        pageNumber: z.ZodOptional<z.ZodNumber>;
        startOffset: z.ZodNumber;
        endOffset: z.ZodNumber;
        relevanceScore: z.ZodNumber;
        snippet: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        documentId: string;
        startOffset: number;
        endOffset: number;
        documentTitle: string;
        relevanceScore: number;
        snippet: string;
        pageNumber?: number | undefined;
    }, {
        documentId: string;
        startOffset: number;
        endOffset: number;
        documentTitle: string;
        relevanceScore: number;
        snippet: string;
        pageNumber?: number | undefined;
    }>, "many">;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    uid: string;
    queryId: string;
    queryText: string;
    durationMs: number;
    resultCount: number;
    citations: {
        documentId: string;
        startOffset: number;
        endOffset: number;
        documentTitle: string;
        relevanceScore: number;
        snippet: string;
        pageNumber?: number | undefined;
    }[];
}, {
    timestamp: string;
    uid: string;
    queryId: string;
    queryText: string;
    durationMs: number;
    resultCount: number;
    citations: {
        documentId: string;
        startOffset: number;
        endOffset: number;
        documentTitle: string;
        relevanceScore: number;
        snippet: string;
        pageNumber?: number | undefined;
    }[];
}>;
export type KnowledgeQueryReceipt = z.infer<typeof KnowledgeQueryReceiptSchema>;
export declare const KnowledgeOperationErrorSchema: z.ZodObject<{
    code: z.ZodEnum<["INVALID_REQUEST", "UNAUTHENTICATED", "UNAUTHORIZED", "DOCUMENT_NOT_FOUND", "INCOMPATIBLE_STATE", "FILE_TOO_LARGE", "UNEXTRACTABLE_DOCUMENT", "RATE_LIMITED", "SERVICE_UNAVAILABLE"]>;
    message: z.ZodString;
    statusCode: z.ZodNumber;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: "INVALID_REQUEST" | "UNAUTHORIZED" | "UNAUTHENTICATED" | "DOCUMENT_NOT_FOUND" | "INCOMPATIBLE_STATE" | "FILE_TOO_LARGE" | "UNEXTRACTABLE_DOCUMENT" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE";
    message: string;
    statusCode: number;
    details?: Record<string, unknown> | undefined;
}, {
    code: "INVALID_REQUEST" | "UNAUTHORIZED" | "UNAUTHENTICATED" | "DOCUMENT_NOT_FOUND" | "INCOMPATIBLE_STATE" | "FILE_TOO_LARGE" | "UNEXTRACTABLE_DOCUMENT" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE";
    message: string;
    statusCode: number;
    details?: Record<string, unknown> | undefined;
}>;
export type KnowledgeOperationError = z.infer<typeof KnowledgeOperationErrorSchema>;
export declare const CreateKnowledgeUploadRequestSchema: z.ZodObject<{
    title: z.ZodString;
    mimeType: z.ZodEnum<["text/plain", "text/markdown", "application/pdf"]>;
    byteSize: z.ZodNumber;
    contentSha256: z.ZodString;
    ext: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    mimeType: "text/plain" | "text/markdown" | "application/pdf";
    byteSize: number;
    contentSha256: string;
    ext?: string | undefined;
}, {
    title: string;
    mimeType: "text/plain" | "text/markdown" | "application/pdf";
    byteSize: number;
    contentSha256: string;
    ext?: string | undefined;
}>;
export type CreateKnowledgeUploadRequest = z.infer<typeof CreateKnowledgeUploadRequestSchema>;
export declare const FinalizeKnowledgeUploadRequestSchema: z.ZodObject<{
    documentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    documentId: string;
}, {
    documentId: string;
}>;
export type FinalizeKnowledgeUploadRequest = z.infer<typeof FinalizeKnowledgeUploadRequestSchema>;
export declare const DeleteKnowledgeDocumentRequestSchema: z.ZodObject<{
    documentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    documentId: string;
}, {
    documentId: string;
}>;
export type DeleteKnowledgeDocumentRequest = z.infer<typeof DeleteKnowledgeDocumentRequestSchema>;
export declare const IndexWorkerPayloadSchema: z.ZodObject<{
    uid: z.ZodString;
    documentId: z.ZodString;
    storagePath: z.ZodString;
    storageGeneration: z.ZodString;
    contentSha256: z.ZodString;
}, "strip", z.ZodTypeAny, {
    storagePath: string;
    uid: string;
    contentSha256: string;
    storageGeneration: string;
    documentId: string;
}, {
    storagePath: string;
    uid: string;
    contentSha256: string;
    storageGeneration: string;
    documentId: string;
}>;
export type IndexWorkerPayload = z.infer<typeof IndexWorkerPayloadSchema>;
//# sourceMappingURL=knowledge.d.ts.map