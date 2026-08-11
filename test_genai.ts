import * as dotenv from 'dotenv';
import { getVertexAIClient } from './packages/firebase/src/lib/vertexClient';
dotenv.config();

async function run() {
  try {
    const ai = getVertexAIClient(
      process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
      process.env.VERTEX_IMAGE_LOCATION || 'global',
    );
    console.log("Generating image...");
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image",
      contents: [{ role: "user", parts: [{ text: "A beautiful sunset over the ocean" }] }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    console.log("Response:", JSON.stringify(response, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
