/**
 * API schemas for indii REST API
 *
 * Defines all request/response types for:
 * - Track management endpoints
 * - Analytics endpoints
 * - Distribution endpoints
 * - Webhook endpoints
 */
import { z } from 'zod';
export declare const TrackSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    artistId: z.ZodString;
    genre: z.ZodOptional<z.ZodString>;
    bpm: z.ZodOptional<z.ZodNumber>;
    duration: z.ZodNumber;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    artistId: string;
    duration: number;
    createdAt: string;
    updatedAt: string;
    description?: string | undefined;
    genre?: string | undefined;
    bpm?: number | undefined;
}, {
    id: string;
    title: string;
    artistId: string;
    duration: number;
    createdAt: string;
    updatedAt: string;
    description?: string | undefined;
    genre?: string | undefined;
    bpm?: number | undefined;
}>;
export declare const CreateTrackSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    genre: z.ZodOptional<z.ZodString>;
    bpm: z.ZodOptional<z.ZodNumber>;
    duration: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    title: string;
    duration: number;
    description?: string | undefined;
    genre?: string | undefined;
    bpm?: number | undefined;
}, {
    title: string;
    duration: number;
    description?: string | undefined;
    genre?: string | undefined;
    bpm?: number | undefined;
}>;
export declare const UpdateTrackSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    genre: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    bpm: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | undefined;
    genre?: string | undefined;
    bpm?: number | undefined;
    duration?: number | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    genre?: string | undefined;
    bpm?: number | undefined;
    duration?: number | undefined;
}>;
export declare const AnalyticsEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    eventId: string;
    eventType: string;
    userId: string;
    timestamp: number;
    data: Record<string, unknown>;
}, {
    eventId: string;
    eventType: string;
    userId: string;
    timestamp: number;
    data: Record<string, unknown>;
}>;
export declare const AnalyticsQuerySchema: z.ZodObject<{
    startDate: z.ZodString;
    endDate: z.ZodString;
    eventTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    startDate: string;
    endDate: string;
    limit: number;
    offset: number;
    eventTypes?: string[] | undefined;
}, {
    startDate: string;
    endDate: string;
    eventTypes?: string[] | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const DistributionSchema: z.ZodObject<{
    id: z.ZodString;
    trackId: z.ZodString;
    platforms: z.ZodArray<z.ZodEnum<["spotify", "apple", "amazon", "youtube", "tiktok"]>, "many">;
    status: z.ZodEnum<["draft", "scheduled", "submitted", "completed", "failed"]>;
    scheduledDate: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    status: "draft" | "scheduled" | "submitted" | "completed" | "failed";
    trackId: string;
    platforms: ("spotify" | "apple" | "amazon" | "youtube" | "tiktok")[];
    scheduledDate?: string | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    status: "draft" | "scheduled" | "submitted" | "completed" | "failed";
    trackId: string;
    platforms: ("spotify" | "apple" | "amazon" | "youtube" | "tiktok")[];
    scheduledDate?: string | undefined;
}>;
export declare const CreateDistributionSchema: z.ZodObject<{
    trackId: z.ZodString;
    platforms: z.ZodArray<z.ZodEnum<["spotify", "apple", "amazon", "youtube", "tiktok"]>, "many">;
    scheduledDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    trackId: string;
    platforms: ("spotify" | "apple" | "amazon" | "youtube" | "tiktok")[];
    scheduledDate?: string | undefined;
}, {
    trackId: string;
    platforms: ("spotify" | "apple" | "amazon" | "youtube" | "tiktok")[];
    scheduledDate?: string | undefined;
}>;
export declare const WebhookSchema: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    events: z.ZodArray<z.ZodString, "many">;
    isActive: z.ZodDefault<z.ZodBoolean>;
    secret: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    events: string[];
    isActive: boolean;
    secret: string;
}, {
    url: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    events: string[];
    secret: string;
    isActive?: boolean | undefined;
}>;
export declare const CreateWebhookSchema: z.ZodObject<{
    url: z.ZodString;
    events: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    url: string;
    events: string[];
}, {
    url: string;
    events: string[];
}>;
export declare const ApiResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    }>>;
    meta: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodNumber;
        requestId: z.ZodString;
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: number;
        requestId: string;
        version: string;
    }, {
        timestamp: number;
        requestId: string;
        version: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    data?: unknown;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    } | undefined;
    meta?: {
        timestamp: number;
        requestId: string;
        version: string;
    } | undefined;
}, {
    success: boolean;
    data?: unknown;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    } | undefined;
    meta?: {
        timestamp: number;
        requestId: string;
        version: string;
    } | undefined;
}>;
export declare const ErrorResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodEnum<["INVALID_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "INTERNAL_ERROR"]>;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: "INVALID_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
        message: string;
        details?: Record<string, unknown> | undefined;
    }, {
        code: "INVALID_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
        message: string;
        details?: Record<string, unknown> | undefined;
    }>;
    meta: z.ZodObject<{
        timestamp: z.ZodNumber;
        requestId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: number;
        requestId: string;
    }, {
        timestamp: number;
        requestId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    success: false;
    error: {
        code: "INVALID_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
        message: string;
        details?: Record<string, unknown> | undefined;
    };
    meta: {
        timestamp: number;
        requestId: string;
    };
}, {
    success: false;
    error: {
        code: "INVALID_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
        message: string;
        details?: Record<string, unknown> | undefined;
    };
    meta: {
        timestamp: number;
        requestId: string;
    };
}>;
export type Track = z.infer<typeof TrackSchema>;
export type CreateTrack = z.infer<typeof CreateTrackSchema>;
export type UpdateTrack = z.infer<typeof UpdateTrackSchema>;
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
export type Distribution = z.infer<typeof DistributionSchema>;
export type CreateDistribution = z.infer<typeof CreateDistributionSchema>;
export type Webhook = z.infer<typeof WebhookSchema>;
export type CreateWebhook = z.infer<typeof CreateWebhookSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
//# sourceMappingURL=api.d.ts.map