import { GoogleGenAI } from '@google/genai';

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ role: 'user', parts: [{ text: 'a neon punk dog' }] }],
      config: {
        imageConfig: { imageSize: '1k' },
        responseModalities: ['IMAGE'],
        tools: [{
                    googleSearch: {
                        searchTypes: {
                            webSearch: {},
                            imageSearch: {},
                        },
                    },
                }]
      }
    });
    console.log("Success with imageSearch");
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}
test();
