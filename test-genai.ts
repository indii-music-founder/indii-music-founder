import { GoogleGenAI } from '@google/genai';

async function test() {
  const ai = new GoogleGenAI({ vertexai: { project: 'indiios-v-1-1', location: 'us-central1' } });
  try {
    const response = await ai.models.generateContent({
      model: 'projects/223837784072/locations/us-central1/endpoints/8815251462566182912',
      contents: 'Hello',
    });
    console.log(response.text);
  } catch (e: any) {
    console.error(e.message);
  }
}
test();
