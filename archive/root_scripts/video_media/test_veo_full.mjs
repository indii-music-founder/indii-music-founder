import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: true,
  project: "indiios-v-1-1",
  location: "us-central1"
});

async function run() {
  try {
    console.log("Creating video operation with FULL config...");
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: 'A cinematic 8k resolution video of a cyberpunk city',
      config: { 
        aspectRatio: '16:9',
        personGeneration: 'allow_adult',
        durationSeconds: 5,
        resolution: '1080p',
        numberOfVideos: 1
      }
    });
    console.log("Operation created! ID:", operation.name);
    
    if (operation.error) {
      console.error("API Rejected immediately:", JSON.stringify(operation.error, null, 2));
      return;
    }

    console.log("Polling...");
    let result = operation;
    while (!result.done) {
      await new Promise(r => setTimeout(r, 10000)); // 10s like cloud function
      result = await ai.operations.getVideosOperation({ operation: result });
      console.log("Poll status:", result.done ? "DONE" : "RUNNING");
    }

    if (!result.response) {
      console.error("No response! Full result object:", JSON.stringify(result, null, 2));
    } else {
      console.log("SUCCESS!", Object.keys(result.response));
    }
  } catch(e) {
    console.error("CRASH:", e);
  }
}

run();
