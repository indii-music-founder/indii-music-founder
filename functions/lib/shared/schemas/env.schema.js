"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonEnvSchema = void 0;
const zod_1 = require("zod");
exports.CommonEnvSchema = zod_1.z.object({
    apiKey: zod_1.z.string().min(1, "API Key is required"),
    projectId: zod_1.z.string().min(1, "Project ID is required"),
    location: zod_1.z.string().default('us-central1'),
    useVertex: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=env.schema.js.map