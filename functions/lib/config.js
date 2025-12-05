"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv = require("dotenv");
const zod_1 = require("zod");
const env_schema_1 = require("./shared/schemas/env.schema");
dotenv.config();
// Common schema + any backend specific overrides/additions
const BackendEnvSchema = env_schema_1.CommonEnvSchema.extend({
    // Backend specific
    GCLOUD_PROJECT: zod_1.z.string().default('architexture-ai-api'),
    MODEL_ID: zod_1.z.string().default('veo-3.1-generate-preview'),
    GEMINI_MODEL_ID: zod_1.z.string().default('gemini-3-pro-image-preview'),
});
const processEnv = {
    // Map process.env to common schema keys
    apiKey: process.env.VITE_API_KEY,
    projectId: process.env.GCLOUD_PROJECT,
    location: process.env.LOCATION || 'us-central1',
    useVertex: false, // functions usually run on server, can be false or environment driven if needed
    // Pass through backend specific
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    MODEL_ID: process.env.MODEL_ID,
    GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID,
    VITE_API_KEY: process.env.VITE_API_KEY, // Keep raw key for compat if needed, though apiKey should suffice
};
const parsed = BackendEnvSchema.safeParse(processEnv);
if (!parsed.success) {
    console.warn("Invalid backend environment configuration:", parsed.error.format());
}
exports.config = parsed.success ? parsed.data : processEnv;
//# sourceMappingURL=config.js.map