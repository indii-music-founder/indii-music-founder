import { isApprovedFineTunedTextEndpoint } from '../packages/firebase/src/config/textStreamModels.js';
import { getVertexAIClient } from '../packages/firebase/src/lib/vertexClient.js';
import { resolveVertexEndpointResource } from '../packages/firebase/src/lib/vertexRouting.js';

async function testSDK() {
  const model = process.argv[2];
  if (!isApprovedFineTunedTextEndpoint(model)) {
    throw new Error('Pass an approved tuned Vertex endpoint resource name as the first argument.');
  }

  const route = resolveVertexEndpointResource(model);
  const ai = getVertexAIClient(route.project, route.location);
  const response = await ai.models.generateContent({
    model: route.resourceName,
    contents: 'Reply with one short sentence confirming that you can receive messages.',
  });
  if (!response.text?.trim()) throw new Error('The tuned endpoint returned no text.');
  console.log(response.text);
}

testSDK().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
