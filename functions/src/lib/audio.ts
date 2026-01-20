import { z } from "zod";

export const GenerateSpeechRequestSchema = z.object({
    text: z.string().min(1, "Text is required"),
    voice: z.string().optional().default("en-US-Journey-F"),
    model: z.string().optional().default("gemini-2.5-pro-tts"),
});
