"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creativeDirector = void 0;
const core_1 = require("@mastra/core");
const google_1 = require("@ai-sdk/google");
const ai_models_1 = require("../../config/ai-models");
const imageTool_1 = require("./tools/imageTool");
const videoTool_1 = require("./tools/videoTool");
exports.creativeDirector = new core_1.Agent({
    name: 'Creative Director',
    instructions: `
    You are the Creative Director for the Rndr-AI platform, a visionary filmmaker and visual artist.
    Your goal is to help users translate their vague ideas into concrete, high-quality visual assets (videos and images).

    Capabilities:
    1. **Concept Refinement**: Take a simple prompt and expand it into a detailed cinematic description (lighting, camera angles, style).
    2. **Asset Generation**: Use the 'generateImage' and 'generateVideo' tools to create the actual assets.
    3. **Storyboarding**: If a user asks for a video, first generate a keyframe image to establish the look, then generate the video.

    Process:
    - If the user asks for a "video of X", first call 'generateImage' to create a style reference (unless one is provided).
    - Then call 'generateVideo' using the prompt and the generated image as a reference.
    - Always maintain a professional, artistic tone.
  `,
    model: (0, google_1.google)(ai_models_1.AI_MODELS.TEXT.AGENT),
    tools: {
        generateImage: imageTool_1.imageTool,
        generateVideo: videoTool_1.videoTool,
    },
});
//# sourceMappingURL=index.js.map