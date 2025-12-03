"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creativeDirector = void 0;
const generative_ai_1 = require("@google/generative-ai");
const ai_models_1 = require("../../config/ai-models");
const imageTool_1 = require("./tools/imageTool");
const videoTool_1 = require("./tools/videoTool");
const SYSTEM_INSTRUCTION = `
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
`;
class CreativeDirectorAgent {
    constructor() {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
        this.model = this.genAI.getGenerativeModel({
            model: ai_models_1.AI_MODELS.TEXT.AGENT,
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{
                    functionDeclarations: [imageTool_1.imageToolDefinition, videoTool_1.videoToolDefinition]
                }]
        });
    }
    async generate(prompt) {
        const chat = this.model.startChat();
        try {
            let result = await chat.sendMessage(prompt);
            let response = result.response;
            let functionCalls = response.functionCalls();
            // Simple loop to handle function calls (max 5 turns to prevent infinite loops)
            let turns = 0;
            while (functionCalls && functionCalls.length > 0 && turns < 5) {
                turns++;
                const parts = [];
                for (const call of functionCalls) {
                    const { name, args } = call;
                    let functionResponse;
                    if (name === 'generateImage') {
                        functionResponse = await (0, imageTool_1.generateImage)(args);
                    }
                    else if (name === 'generateVideo') {
                        functionResponse = await (0, videoTool_1.generateVideo)(args);
                    }
                    else {
                        functionResponse = { error: `Unknown function ${name}` };
                    }
                    parts.push({
                        functionResponse: {
                            name,
                            response: functionResponse
                        }
                    });
                }
                // Send function results back to the model
                result = await chat.sendMessage(parts);
                response = result.response;
                functionCalls = response.functionCalls();
            }
            return { text: response.text() };
        }
        catch (error) {
            console.error("Creative Director Agent Error:", error);
            return { text: "I encountered an error while processing your request." };
        }
    }
}
exports.creativeDirector = new CreativeDirectorAgent();
//# sourceMappingURL=index.js.map