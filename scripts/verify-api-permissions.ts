import 'dotenv/config';
import { FUNCTION_INTELLIGENCE_MODELS } from '../packages/firebase/src/config/models.js';
import { getVertexAIClient } from '../packages/firebase/src/lib/vertexClient.js';

async function run() {
    const client = getVertexAIClient();
    const result = await client.models.generateContent({
        model: FUNCTION_INTELLIGENCE_MODELS.TEXT.LITE,
        contents: 'Reply with one word to confirm connectivity.',
        config: { httpOptions: { timeout: 30_000 } },
    });
    if (!result.text?.trim()) throw new Error('Vertex returned no text.');
    console.log('Vertex AI accepted the Application Default Credentials and generated text.');
}

run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
