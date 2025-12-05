import { z } from 'zod';

export const CommonEnvSchema = z.object({
    apiKey: z.string().min(1, "API Key is required"),
    projectId: z.string().min(1, "Project ID is required"),
    location: z.string().default('us-central1'),
    useVertex: z.boolean().default(false),
});

export type CommonEnv = z.infer<typeof CommonEnvSchema>;
