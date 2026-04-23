import { GoogleGenAI } from "@google/genai";
const client = new GoogleGenAI({ apiKey: "AIzaSy_fake_fake_fake" });
const config = {
  responseModalities: ["IMAGE"],
  imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
  tools: [{ googleSearch: {} }]
};
const contents = [{ role: "user", parts: [{ text: "Hello" }] }];

client.models.generateContent({ model: "gemini-3.1-flash-image-preview", contents, config })
  .catch(e => console.error(e.stack));
