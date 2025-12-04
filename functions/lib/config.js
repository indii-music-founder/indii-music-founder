"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv = require("dotenv");
const zod_1 = require("zod");
dotenv.config();
const envSchema = zod_1.z.object({
    GCLOUD_PROJECT: zod_1.z.string().default('architexture-ai-api'),
    LOCATION: zod_1.z.string().default('us-central1'),
    MODEL_ID: zod_1.z.string().default('veo-3.1-generate-preview'),
    GEMINI_MODEL_ID: zod_1.z.string().default('gemini-3-pro-image-preview'),
    VITE_API_KEY: zod_1.z.string().min(1, "VITE_API_KEY is required"),
});
const processEnv = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    LOCATION: process.env.LOCATION || 'us-central1',
    MODEL_ID: process.env.MODEL_ID,
    GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID,
    VITE_API_KEY: process.env.VITE_API_KEY,
};
const parsed = envSchema.safeParse(processEnv);
if (!parsed.success) {
    console.warn("Invalid backend environment configuration:", parsed.error.format());
}
exports.config = parsed.success ? parsed.data : processEnv;
//# sourceMappingURL=config.js.map