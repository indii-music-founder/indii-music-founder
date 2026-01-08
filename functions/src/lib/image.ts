import { z } from "zod";

export const GenerateImageRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    aspectRatio: z.enum(["1:1", "16:9", "9:16", "3:4", "4:3"]).optional(),
    count: z.number().int().min(1).max(4).optional().default(1),
    images: z.array(z.object({
        mimeType: z.string(),
        data: z.string() // Base64 encoded data
    })).optional(),
});

export const EditImageRequestSchema = z.object({
    image: z.string().min(1, "Base image is required"), // Base64
    mask: z.string().optional(), // Base64
    prompt: z.string().min(1, "Prompt is required"),
    referenceImage: z.string().optional(), // Base64
});

export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;
export type EditImageRequest = z.infer<typeof EditImageRequestSchema>;
