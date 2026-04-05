"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditImageRequestSchema = exports.GenerateImageRequestSchema = void 0;
const zod_1 = require("zod");
exports.GenerateImageRequestSchema = zod_1.z.object({
    prompt: zod_1.z.string().min(1, "Prompt is required"),
    aspectRatio: zod_1.z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]).nullish(),
    count: zod_1.z.number().int().min(1).max(4).nullish().default(1),
    images: zod_1.z.array(zod_1.z.object({
        mimeType: zod_1.z.string(),
        data: zod_1.z.string() // Base64 encoded data
    })).nullish(),
    model: zod_1.z.enum(["fast", "pro"]).nullish().default("fast"),
    imageSize: zod_1.z.enum(["1k", "2k", "4k"]).nullish().default("1k"),
    thinking: zod_1.z.boolean().nullish().default(false),
    useGrounding: zod_1.z.boolean().nullish().default(false)
});
exports.EditImageRequestSchema = zod_1.z.object({
    image: zod_1.z.string().min(1, "Base image is required"), // Base64
    imageMimeType: zod_1.z.string().default("image/png"), // Image format
    mask: zod_1.z.string().nullish(), // Base64
    maskMimeType: zod_1.z.string().nullish(), // Mask format
    prompt: zod_1.z.string().min(1, "Prompt is required"),
    referenceImage: zod_1.z.string().nullish(), // Base64
    refMimeType: zod_1.z.string().nullish(), // Reference image format
    model: zod_1.z.string().nullish(), // Model ID
    thoughtSignature: zod_1.z.string().nullish(), // Gemini 3 Logic State
});
//# sourceMappingURL=image.js.map