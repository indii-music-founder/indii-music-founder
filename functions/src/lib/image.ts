import { z } from "zod";

export const PartSchema = z.object({
    text: z.string().optional(),
    inlineData: z.object({
        mimeType: z.string(),
        data: z.string()
    }).optional(),
    thoughtSignature: z.string().optional()
});

export const ContentSchema = z.object({
    role: z.enum(["user", "model"]),
    parts: z.array(PartSchema)
});

export const GenerateImageRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    aspectRatio: z.enum(["1:1", "16:9", "9:16", "3:4", "4:3"]).optional(),
    count: z.number().int().min(1).max(4).optional().default(1),
    images: z.array(z.object({
        mimeType: z.string(),
        data: z.string() // Base64 encoded data
    })).optional(),
    history: z.array(ContentSchema).optional(), // Support for conversational context
    model: z.enum(["fast", "pro"]).optional().default("fast"),
    mediaResolution: z.enum(["low", "medium", "high", "ultra_high"]).optional().default("medium"),
    thinking: z.boolean().optional().default(false),
    useGrounding: z.boolean().optional().default(false)
});

export const EditImageRequestSchema = z.object({
    image: z.string().optional(), // Optional if history is provided
    imageMimeType: z.string().optional().default("image/png"),
    mask: z.string().optional(),
    maskMimeType: z.string().optional(),
    prompt: z.string().min(1, "Prompt is required"),
    referenceImage: z.string().optional(),
    refMimeType: z.string().optional(),
    history: z.array(ContentSchema).optional(), // For conversational editing (linking to previous generation)
    thoughtSignatures: z.record(z.string()).optional() // Map of part index/ref to signature
});

export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;
export type EditImageRequest = z.infer<typeof EditImageRequestSchema>;
