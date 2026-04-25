/**
 * API schemas for indiiOS REST API
 *
 * Defines all request/response types for:
 * - Track management endpoints
 * - Analytics endpoints
 * - Distribution endpoints
 * - Webhook endpoints
 */

import { z } from 'zod';

// Track Schemas
export const TrackSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  artistId: z.string().uuid(),
  genre: z.string().optional(),
  bpm: z.number().optional(),
  duration: z.number(), // milliseconds
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateTrackSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  genre: z.string().optional(),
  bpm: z.number().optional(),
  duration: z.number(),
});

export const UpdateTrackSchema = CreateTrackSchema.partial();

// Analytics Schemas
export const AnalyticsEventSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  userId: z.string(),
  timestamp: z.number(),
  data: z.record(z.unknown()),
});

export const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  eventTypes: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

// Distribution Schemas
export const DistributionSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
  platforms: z.array(z.enum(['spotify', 'apple', 'amazon', 'youtube', 'tiktok'])),
  status: z.enum(['draft', 'scheduled', 'submitted', 'completed', 'failed']),
  scheduledDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateDistributionSchema = z.object({
  trackId: z.string().uuid(),
  platforms: z.array(z.enum(['spotify', 'apple', 'amazon', 'youtube', 'tiktok'])).min(1),
  scheduledDate: z.string().datetime().optional(),
});

// Webhook Schemas
export const WebhookSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  isActive: z.boolean().default(true),
  secret: z.string(), // HMAC secret
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

// API Response Wrapper
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }).optional(),
  meta: z.object({
    timestamp: z.number(),
    requestId: z.string(),
    version: z.string(),
  }).optional(),
});

// Error Response
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.enum(['INVALID_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'INTERNAL_ERROR']),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  meta: z.object({
    timestamp: z.number(),
    requestId: z.string(),
  }),
});

// Type exports
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
