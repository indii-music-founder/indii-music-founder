import 'dotenv/config';
import { getVertexAIClient } from '../packages/firebase/src/lib/vertexClient.js';

const ai = getVertexAIClient(undefined, process.env.VERTEX_VIDEO_LOCATION || 'us-central1');

async function run() {
  console.log('Testing Veo 3.1 video generation...');
  
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-001',
      source: { prompt: 'A slow tracking shot through a recording studio as the morning light changes.' },
      config: {
        aspectRatio: '16:9'
      }
    });

    console.log('Operation:', operation.name);
    
    while (!operation.done) {
        await new Promise(r => setTimeout(r, 10000));
        console.log('Polling operation...');
        operation = await ai.operations.getVideosOperation({ operation });
        console.log('Done?', operation.done);
    }
    if (operation.error) throw new Error(JSON.stringify(operation.error));
    const video = operation.response?.generatedVideos?.[0]?.video;
    if (!video?.videoBytes && !video?.uri) throw new Error('Veo returned no video.');
    console.log('Veo returned a video.');
    
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  }
}

run();
