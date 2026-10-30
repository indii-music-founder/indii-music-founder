/** HTTP grammar for the advertised SDK surface. It grants no account/resource access. */
export type SdkOperation = 'listTracks' | 'createTrack' | 'getTrack' | 'updateTrack' | 'deleteTrack'
  | 'listDistributions' | 'createDistribution' | 'getDistribution' | 'submitDistribution'
  | 'getEvents' | 'getCatalog' | 'getProfile' | 'updateProfile';

export function validSdkIdentifier(value: string | undefined): value is string {
  return !!value && value.length <= 160 && value !== '.' && value !== '..' &&
    !/[\\/]/.test(value) && !Array.from(value).some(char => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127;
    });
}

export function sdkRoute(method: string, rawPath: string): { operation: SdkOperation; id?: string } | undefined {
  const path = rawPath.split('?')[0];
  const fixed: Record<string, SdkOperation> = {
    'GET /tracks': 'listTracks', 'POST /tracks': 'createTrack',
    'GET /distributions': 'listDistributions', 'POST /distributions': 'createDistribution',
    'GET /analytics/events': 'getEvents', 'GET /catalog/v1': 'getCatalog',
    'GET /account/profile': 'getProfile', 'PATCH /account/profile': 'updateProfile',
  };
  const operation = fixed[`${method} ${path}`];
  if (operation) return { operation };
  const match = /^\/(tracks|distributions)\/([^/]+)(\/submit)?$/.exec(path);
  if (!match) return undefined;
  let id: string;
  try { id = decodeURIComponent(match[2]); } catch { return undefined; }
  if (!validSdkIdentifier(id)) return undefined;
  const routes: Record<string, SdkOperation> = {
    'GET tracks': 'getTrack', 'PATCH tracks': 'updateTrack', 'DELETE tracks': 'deleteTrack',
    'GET distributions': 'getDistribution', 'POST distributions/submit': 'submitDistribution',
  };
  const selected = routes[`${method} ${match[1]}${match[3] || ''}`];
  return selected ? { operation: selected, id } : undefined;
}
