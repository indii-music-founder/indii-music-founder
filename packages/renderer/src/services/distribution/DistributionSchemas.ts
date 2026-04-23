import { z } from 'zod';

/**
 * Zod schema for DDEX Track metadata.
 * Validates against DDEX ERN 4.3 requirements and internal business rules.
 */
export const DDEXTrackSchema = z.object({
    title: z.string().min(1, 'Track title is required').max(200),
    version: z.string().optional(),
    artist: z.string().min(1, 'Primary artist is required'),
    artists: z.array(z.string()).min(1, 'At least one artist is required'),
    isrc: z.string().regex(/^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$/, 'Invalid ISRC format').optional().or(z.literal('')),
    duration: z.number().positive('Duration must be positive').optional(),
    explicit: z.boolean().default(false),
    genre: z.string().optional(),
    sub_genre: z.string().optional(),
    language: z.string().length(2, 'ISO 639-1 language code (2 chars) required').optional().default('en'),
    p_line: z.string().optional(),
    c_line: z.string().optional(),
    track_number: z.number().int().positive().optional(),
    volume_number: z.number().int().positive().optional().default(1),
});

/**
 * Zod schema for full DDEX Release metadata.
 */
export const DDEXReleaseSchema = z.object({
    releaseId: z.string().min(1),
    title: z.string().min(1, 'Release title is required').max(200),
    version: z.string().optional(),
    artist: z.string().min(1, 'Primary artist is required'),
    artists: z.array(z.string()).min(1, 'At least one artist is required'),
    tracks: z.array(DDEXTrackSchema).min(1, 'Release must contain at least one track'),
    label: z.string().min(1, 'Label name is required').default('Indii Records'),
    upc: z.string().regex(/^\d{12,13}$/, 'Invalid UPC/EAN format').optional().or(z.literal('')),
    genre: z.string().min(1, 'Primary genre is required'),
    release_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Release date must be YYYY-MM-DD').optional(),
    artwork_url: z.string().url('Invalid artwork URL').optional(),
    p_line: z.string().optional(),
    c_line: z.string().optional(),
    is_compilation: z.boolean().default(false),
});

export type ValidatedDDEXTrack = z.infer<typeof DDEXTrackSchema>;
export type ValidatedDDEXRelease = z.infer<typeof DDEXReleaseSchema>;
