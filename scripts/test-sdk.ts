import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';

async function testSDK() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const ai = new GoogleGenAI({
    vertexai: {
      project: 'indiios-v-1-1',
      location: 'us-central1',
    }
  });

  try {
    const res = await ai.models.generateContent({
      model: 'projects/223837784072/locations/us-central1/models/5672388184277778432',
      contents: [{ role: 'user', parts: [{ text: 'Hello, are you operational?' }] }]
    });
    console.log(res.text());
  } catch (err: any) {
    console.error('Error:', err);
  }
}

testSDK();
