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
//# sourceMappingURL=video.js.map