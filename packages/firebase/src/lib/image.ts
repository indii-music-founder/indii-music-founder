import { z } from "zod";

export const GenerateImageRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    aspectRatio: z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]).nullish(),
    count: z.number().int().min(1).max(4).nullish().default(1),
    images: z.array(z.object({
        mimeType: z.string(),
        data: z.string() // Base64 encoded data
    })).nullish(),
    model: z.enum(["fast", "pro"]).nullish().default("fast"),
    imageSize: z.enum(["1k", "2k", "4k"]).nullish().default("1k"),
    thinking: z.boolean().nullish().default(false),
    useGrounding: z.boolean().nullish().default(false)
});

export const EditImageRequestSchema = z.object({
    image: z.string().min(1, "Base image is required"), // Base64
    imageMimeType: z.string().default("image/png"), // Image format
    mask: z.string().nullish(), // Base64
    maskMimeType: z.string().nullish(), // Mask format
    prompt: z.string().min(1, "Prompt is required"),
    referenceImage: z.string().nullish(), // Base64
    refMimeType: z.string().nullish(), // Reference image format
    model: z.string().nullish(), // Model ID
    thoughtSignature: z.string().nullish(), // Gemini 3 Logic State
});

export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;
export type EditImageRequest = z.infer<typeof EditImageRequestSchema>;
