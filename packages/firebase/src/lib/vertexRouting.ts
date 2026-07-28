/**
 * Canonical Vertex AI resource routing.
 *
 * Vertex resource locations are part of the resource identity. Do not rewrite
 * them to another location and do not construct Vertex API hosts outside this
 * module. Multi-region resources use replica hosts; regional resources use
 * location-prefixed hosts.
 *
 * Reference:
 * https://cloud.google.com/vertex-ai/docs/general/locations
 * https://cloud.google.com/docs/security/compliance/endpoints
 */

export type VertexLocationKind = 'global' | 'multi-region' | 'regional';
export type VertexRoutingErrorReason =
  | 'INVALID_LOCATION'
  | 'UNSUPPORTED_LOCATION'
  | 'INVALID_RESOURCE'
  | 'HOST_LOCATION_MISMATCH';

export class VertexRoutingError extends Error {
  readonly code = 'VERTEX_ROUTING_UNRESOLVED';

  constructor(
    readonly reason: VertexRoutingErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'VertexRoutingError';
  }
}

export interface VertexLocationRoute {
  location: string;
  kind: VertexLocationKind;
  baseUrl: string;
}

export interface VertexEndpointRoute extends VertexLocationRoute {
  project: string;
  endpointId: string;
  resourceName: string;
}

const MULTI_REGION_HOSTS = {
  us: 'https://aiplatform.us.rep.googleapis.com',
  eu: 'https://aiplatform.eu.rep.googleapis.com',
} as const;

// Fail closed so a newly introduced location must be reviewed against Google's
// supported Vertex locations before it can generate a hostname.
const SUPPORTED_REGIONAL_LOCATIONS = new Set([
  'africa-south1',
  'asia-east1',
  'asia-east2',
  'asia-northeast1',
  'asia-northeast2',
  'asia-northeast3',
  'asia-south1',
  'asia-south2',
  'asia-southeast1',
  'asia-southeast2',
  'australia-southeast1',
  'australia-southeast2',
  'europe-central2',
  'europe-north1',
  'europe-southwest1',
  'europe-west1',
  'europe-west2',
  'europe-west3',
  'europe-west4',
  'europe-west6',
  'europe-west8',
  'europe-west9',
  'europe-west10',
  'europe-west12',
  'me-central1',
  'me-central2',
  'me-west1',
  'northamerica-northeast1',
  'northamerica-northeast2',
  'southamerica-east1',
  'southamerica-west1',
  'us-central1',
  'us-east1',
  'us-east4',
  'us-east5',
  'us-south1',
  'us-west1',
  'us-west2',
  'us-west3',
  'us-west4',
]);

const ENDPOINT_RESOURCE_PATTERN =
  /^projects\/([^/]+)\/locations\/([^/]+)\/endpoints\/([^/]+)$/;

export function resolveVertexLocation(location: string): VertexLocationRoute {
  if (!location || location !== location.trim() || !/^[a-z0-9-]+$/.test(location)) {
    throw new VertexRoutingError('INVALID_LOCATION', 'Vertex location is malformed.');
  }

  if (location === 'global') {
    return {
      location,
      kind: 'global',
      baseUrl: 'https://aiplatform.googleapis.com',
    };
  }

  if (location in MULTI_REGION_HOSTS) {
    return {
      location,
      kind: 'multi-region',
      baseUrl: MULTI_REGION_HOSTS[location as keyof typeof MULTI_REGION_HOSTS],
    };
  }

  if (SUPPORTED_REGIONAL_LOCATIONS.has(location)) {
    return {
      location,
      kind: 'regional',
      baseUrl: `https://${location}-aiplatform.googleapis.com`,
    };
  }

  throw new VertexRoutingError(
    'UNSUPPORTED_LOCATION',
    `Vertex location "${location}" has not been approved by the canonical resolver.`,
  );
}

export function resolveVertexEndpointResource(
  resourceName: string,
  expectedBaseUrl?: string,
): VertexEndpointRoute {
  const match = ENDPOINT_RESOURCE_PATTERN.exec(resourceName);
  if (!match) {
    throw new VertexRoutingError(
      'INVALID_RESOURCE',
      'Vertex endpoint resource name is malformed.',
    );
  }

  const [, project, location, endpointId] = match;
  if (!project || !location || !endpointId) {
    throw new VertexRoutingError(
      'INVALID_RESOURCE',
      'Vertex endpoint resource identity is incomplete.',
    );
  }

  const route = resolveVertexLocation(location);
  if (expectedBaseUrl && expectedBaseUrl !== route.baseUrl) {
    throw new VertexRoutingError(
      'HOST_LOCATION_MISMATCH',
      'Vertex endpoint resource location does not match the selected API host.',
    );
  }

  return {
    ...route,
    project,
    endpointId,
    resourceName,
  };
}
