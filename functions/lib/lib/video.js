"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoJobSchema = void 0;
const zod_1 = require("zod");
exports.VideoJobSchema = zod_1.z.object({
    jobId: zod_1.z.string().min(1),
    userId: zod_1.z.string().min(1),
    prompt: zod_1.z.string().min(1),
    duration: zod_1.z.string().optional(),
    fps: zod_1.z.string().optional(),
    options: zod_1.z.object({
        aspectRatio: zod_1.z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
        resolution: zod_1.z.enum(["720p", "1080p"]).optional().default("720p"),
    }).optional(),
});
jobId: zod_1.z.string(),
    userId;
zod_1.z.string().optional(),
    orgId;
zod_1.z.string().optional(),
    prompt;
zod_1.z.string().min(1),
    resolution;
zod_1.z.string().optional(),
    aspectRatio;
zod_1.z.string().optional(),
    negativePrompt;
zod_1.z.string().optional(),
    seed;
zod_1.z.number().optional(),
    fps;
zod_1.z.number().optional(),
    cameraMovement;
zod_1.z.string().optional(),
    motionStrength;
zod_1.z.number().optional(),
    shotList;
zod_1.z.array(zod_1.z.any()).optional(),
    firstFrame;
zod_1.z.string().optional(),
    lastFrame;
zod_1.z.string().optional(),
    timeOffset;
zod_1.z.number().optional(),
    ingredients;
zod_1.z.array(zod_1.z.string()).optional(),
    duration;
zod_1.z.string().optional(), // e.g. "5s"
    durationSeconds;
zod_1.z.number().optional(),
;
;
//# sourceMappingURL=video.js.map