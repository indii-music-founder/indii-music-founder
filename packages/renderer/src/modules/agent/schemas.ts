import { z } from 'zod';

export const VenueSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().optional(),
    capacity: z.number().nonnegative(),
    genres: z.array(z.string()),
    website: z.string().url().optional().or(z.literal('')),
    contactEmail: z.string().email().optional().or(z.literal('')),
    contactName: z.string().optional(),
    instagramHandle: z.string().optional(),
    status: z.enum(['active', 'blacklisted', 'unknown', 'closed']),
    notes: z.string().optional(),
    // Handles number (Date.now()) or Firestore Timestamp object (has seconds/nanoseconds)
    // Handles number (Date.now()) or Firestore Timestamp object (has seconds/nanoseconds)
    lastScoutedAt: z.union([
        z.number(),
        z.object({ seconds: z.number(), nanoseconds: z.number() }).transform(val => val.seconds * 1000 + val.nanoseconds / 1000000)
    ]).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    fitScore: z.number().min(0).max(100).optional()
});

export const SearchOptionsSchema = z.object({
    city: z.string().min(1),
    genre: z.string().min(1),
    isAutonomous: z.boolean().optional().default(false)
});

export type Venue = z.infer<typeof VenueSchema>;
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;
