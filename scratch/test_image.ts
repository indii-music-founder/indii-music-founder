import { GoogleGenAI } from '@google/genai';

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ role: 'user', parts: [{ text: 'a neon punk cat' }] }],
      config: {
        imageConfig: { imageSize: '1k' },
        responseModalities: ['IMAGE'],
        tools: [{ googleSearch: {} }]
      }
    });
    console.log("Success with 1k and tools");
  } catch (e: any) {
    console.log("Error:", e.message);
    console.log(e.stack);
  }
}
test();
