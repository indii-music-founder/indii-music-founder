import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';

const ai = new GoogleGenAI({ vertexai: { project: 'indii-music-founder', location: 'us-central1' } });
ai.models.generateContent({
    model: 'projects/148015878263/locations/us-central1/endpoints/8440177260006211584',
    contents: 'hello'
}).catch(console.error);
