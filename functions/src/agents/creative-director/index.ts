import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_MODELS } from '../../config/ai-models';
import { imageToolDefinition, generateImage } from './tools/imageTool';
import { videoToolDefinition, generateVideo } from './tools/videoTool';

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
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({
      model: AI_MODELS.TEXT.AGENT,
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{
        functionDeclarations: [imageToolDefinition as any, videoToolDefinition as any]
      }]
    });
  }

  async generate(prompt: string) {
    const chat = this.model.startChat();

    try {
      let result = await chat.sendMessage(prompt);
      let response = result.response;
      let functionCalls = response.functionCalls();

      // Simple loop to handle function calls (max 5 turns to prevent infinite loops)
      let turns = 0;
      while (functionCalls && functionCalls.length > 0 && turns < 5) {
        turns++;
        const parts: any[] = [];

        for (const call of functionCalls) {
          const { name, args } = call;
          let functionResponse;

          if (name === 'generateImage') {
            functionResponse = await generateImage(args as any);
          } else if (name === 'generateVideo') {
            functionResponse = await generateVideo(args as any);
          } else {
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

    } catch (error: any) {
      console.error("Creative Director Agent Error:", error);
      return { text: "I encountered an error while processing your request." };
    }
  }
}

export const creativeDirector = new CreativeDirectorAgent();
