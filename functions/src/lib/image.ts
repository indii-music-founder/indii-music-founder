import { z } from "zod";

export const GenerateImageRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    aspectRatio: z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]).optional(),
    count: z.number().int().min(1).max(4).optional().default(1),
    images: z.array(z.object({
        mimeType: z.string(),
        data: z.string() // Base64 encoded data
    })).optional(),
    model: z.enum(["fast", "pro"]).optional().default("fast"),
    imageSize: z.enum(["1k", "2k", "4k"]).optional().default("1k"),
    mediaResolution: z.enum(["low", "medium", "high"]).optional().default("medium"),
    thinking: z.boolean().optional().default(false),
    useGrounding: z.boolean().optional().default(false)
});

export const EditImageRequestSchema = z.object({
    image: z.string().min(1, "Base image is required"), // Base64
    imageMimeType: z.string().default("image/png"), // Image format
    mask: z.string().optional(), // Base64
    maskMimeType: z.string().optional(), // Mask format
    prompt: z.string().min(1, "Prompt is required"),
    referenceImage: z.string().optional(), // Base64
    refMimeType: z.string().optional(), // Reference image format
});

export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;
export type EditImageRequest = z.infer<typeof EditImageRequestSchema>;
