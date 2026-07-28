import { describe, expect, it } from 'vitest';
import {
  resolveVertexEndpointResource,
  resolveVertexLocation,
  VertexRoutingError,
} from './vertexRouting';

describe('canonical Vertex routing', () => {
  it.each([
    ['global', 'global', 'https://aiplatform.googleapis.com'],
    ['us', 'multi-region', 'https://aiplatform.us.rep.googleapis.com'],
    ['eu', 'multi-region', 'https://aiplatform.eu.rep.googleapis.com'],
    ['us-central1', 'regional', 'https://us-central1-aiplatform.googleapis.com'],
    ['europe-west4', 'regional', 'https://europe-west4-aiplatform.googleapis.com'],
  ] as const)('routes %s as %s', (location, kind, baseUrl) => {
    expect(resolveVertexLocation(location)).toEqual({ location, kind, baseUrl });
  });

  it.each(['', ' US ', 'moon-1', 'us.foo', 'GLOBAL'])(
    'fails closed for unsupported or malformed location %j',
    (location) => {
      expect(() => resolveVertexLocation(location)).toThrow(VertexRoutingError);
    },
  );

  it('preserves the complete endpoint resource identity', () => {
    const resourceName =
      'projects/148015878263/locations/us/endpoints/1720656532632240128';

    expect(resolveVertexEndpointResource(resourceName)).toMatchObject({
      project: '148015878263',
      location: 'us',
      endpointId: '1720656532632240128',
      resourceName,
      baseUrl: 'https://aiplatform.us.rep.googleapis.com',
    });
  });

  it('rejects an endpoint resource paired with an inconsistent host', () => {
    expect(() => resolveVertexEndpointResource(
      'projects/148015878263/locations/us/endpoints/1720656532632240128',
      'https://aiplatform.googleapis.com',
    )).toThrowError(expect.objectContaining({
      code: 'VERTEX_ROUTING_UNRESOLVED',
      reason: 'HOST_LOCATION_MISMATCH',
    }));
  });

  it('rejects partial and rewritten endpoint resources', () => {
    expect(() => resolveVertexEndpointResource(
      'projects/148015878263/locations/global/endpoints',
    )).toThrowError(expect.objectContaining({
      reason: 'INVALID_RESOURCE',
    }));
  });
});
