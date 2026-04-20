import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// The project uses VITE_API_KEY as the Gemini key
const apiKey = process.env.VITE_API_KEY;
if (!apiKey) {
  console.error("Missing VITE_API_KEY in environment");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
  console.log('Testing Veo 3.1 video generation...');
  
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: 'A neon cyberpunk city with flying cars.',
      config: {
        aspectRatio: '16:9'
      }
    });

    console.log('Operation:', operation);
    
    while (!operation.done) {
        await new Promise(r => setTimeout(r, 10000));
        console.log('Polling operation...');
        operation = await ai.operations.getVideosOperation({ operation });
        console.log('Done?', operation.done);
        if (operation.error) {
           console.log('Error:', operation.error);
           break;
        }
    }
    console.log('Final response:', JSON.stringify(operation.response, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
