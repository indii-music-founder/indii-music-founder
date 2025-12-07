"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.helloGenkit = exports.ai = void 0;
const genkit_1 = require("genkit");
const googleai_1 = require("@genkit-ai/googleai");
const zod_1 = require("zod");
exports.ai = (0, genkit_1.genkit)({
    plugins: [
        (0, googleai_1.googleAI)(),
    ],
});
exports.helloGenkit = exports.ai.defineFlow({
    name: "helloGenkit",
    inputSchema: zod_1.z.string(),
    outputSchema: zod_1.z.string(),
}, async (subject) => {
    return `Hello, ${subject}! Genkit is running.`;
});
//# sourceMappingURL=genkit.js.map