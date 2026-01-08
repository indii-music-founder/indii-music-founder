import { z } from 'zod';

export const FetchUrlSchema = z.string().url().refine((url) => {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}, { message: "Only HTTP and HTTPS protocols are allowed" });

export const AgentActionSchema = z.object({
    action: z.enum(['click', 'type', 'scroll', 'wait', 'hover', 'press', 'extract']),
    selector: z.string().min(1),
    text: z.string().optional()
});

export const AgentNavigateSchema = z.object({
    url: FetchUrlSchema
});

export const SFTPConfigSchema = z.object({
    host: z.string().min(1),
    port: z.number().int().positive().optional().default(22),
    username: z.string().min(1),
    password: z.string().optional(),
    privateKey: z.string().optional()
}).refine(data => data.password || data.privateKey, {
    message: "Either password or privateKey must be provided"
});

export const CredentialSchema = z.object({
    id: z.string().min(1),
    creds: z.record(z.string().optional())
});

export const AudioAnalyzeSchema = z.string().min(1).refine((path) => {
    // Prevent traversal
    if (path.includes('..')) return false;
    // Allow typical audio extensions
    return /\.(wav|mp3|flac|ogg|aiff|m4a)$/i.test(path);
}, { message: "Invalid audio file path (Traversal detected or unsupported extension)" });

export const DistributionStageReleaseSchema = z.object({
    releaseId: z.string().uuid(),
    files: z.array(z.object({
        type: z.string(),
        data: z.string(), // base64 or path
        name: z.string().refine(name => !name.includes('..') && !name.startsWith('/') && !name.includes('\\'), {
            message: "File name must not contain path traversal characters"
        })
    }))
});
