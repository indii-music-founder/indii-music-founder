"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creativeDirector = void 0;
const core_1 = require("@mastra/core");
const google_1 = require("@ai-sdk/google");
const ai_models_1 = require("../../config/ai-models");
const imageTool_1 = require("./tools/imageTool");
exports.creativeDirector = new core_1.Agent({
    name: 'Creative Director',
    instructions: `
    You are the Creative Director for the Rndr-AI platform.
    Your role is to oversee the creation of visual assets (images and videos).
    
    You have access to tools that can generate images and video treatments.
    When a user asks for a visual creation, you should:
    1. Analyze the request.
    2. Refine the prompt for artistic quality.
    3. Use the appropriate tool to generate the asset.
    4. Maintain brand consistency based on the user's Brand Kit.
  `,
    model: (0, google_1.google)(ai_models_1.AI_MODELS.TEXT.AGENT),
    tools: {
        generateImage: imageTool_1.imageTool,
    },
});
//# sourceMappingURL=index.js.map