"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoJobSchema = void 0;
const zod_1 = require("zod");
exports.VideoJobSchema = zod_1.z.object({
    jobId: zod_1.z.string().min(1),
    userId: zod_1.z.string().optional().nullable(),
    orgId: zod_1.z.string().optional().nullable(),
    prompt: zod_1.z.string().min(1),
    resolution: zod_1.z.string().optional().nullable(),
    aspectRatio: zod_1.z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9").nullable(),
    negativePrompt: zod_1.z.string().optional().nullable(),
    seed: zod_1.z.number().optional().nullable(),
    fps: zod_1.z.number().optional().nullable(),
    cameraMovement: zod_1.z.string().optional().nullable(),
    motionStrength: zod_1.z.number().optional().nullable(),
    shotList: zod_1.z.array(zod_1.z.any()).optional().nullable(),
    firstFrame: zod_1.z.string().optional().nullable(),
    inputVideo: zod_1.z.string().optional().nullable(), // For video extension
    image: zod_1.z.object({
        imageBytes: zod_1.z.string(),
        mimeType: zod_1.z.string().optional()
    }).optional().nullable(),
    lastFrame: zod_1.z.string().optional().nullable(),
    timeOffset: zod_1.z.number().optional().nullable(),
    ingredients: zod_1.z.array(zod_1.z.string()).optional().nullable(),
    referenceImages: zod_1.z.array(zod_1.z.object({
        image: zod_1.z.object({
            imageBytes: zod_1.z.string().optional(),
            uri: zod_1.z.string().optional()
        }).optional(),
        referenceType: zod_1.z.enum(["ASSET", "STYLE"]).optional().default("ASSET")
    })).optional().nullable(),
    personGeneration: zod_1.z.enum(["dont_allow", "allow_adult", "allow_all"]).optional().nullable(),
    duration: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(), // Allow number and null
    durationSeconds: zod_1.z.number().optional().nullable(),
    generateAudio: zod_1.z.boolean().optional().nullable(),
    thinking: zod_1.z.boolean().optional().nullable(),
    model: zod_1.z.string().optional().nullable(),
    options: zod_1.z.object({
        aspectRatio: zod_1.z.enum(["16:9", "9:16", "1:1"]).optional(),
        resolution: zod_1.z.enum(["720p", "1080p", "4k"]).optional(),
    }).optional().nullable(),
});
//# sourceMappingURL=video.js.map