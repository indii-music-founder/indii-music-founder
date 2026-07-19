import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

const mapsDisabled = () => toolError(
    'Maps browser API access is disabled by security policy. Route Maps and Places requests through a backend proxy before enabling this tool.',
    'MAPS_BROWSER_DISABLED'
);

export const MapsTools = {
    search_places: wrapTool('search_places', async () => mapsDisabled()),
    get_place_details: wrapTool('get_place_details', async () => mapsDisabled()),
    get_distance_matrix: wrapTool('get_distance_matrix', async () => mapsDisabled()),
} satisfies Record<string, AnyToolFunction>;
