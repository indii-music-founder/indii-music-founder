import { IndiiMcpTool } from '../types.js';

export const generatePlaylistPitch: IndiiMcpTool = {
    name: 'generate_playlist_pitch',
    description: 'Generates highly targeted pitch emails for Spotify Editorial curators based on audio analysis.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string', description: 'The ID of the release in Firestore' },
            targetPlaylist: { type: 'string', description: 'Name of the playlist (e.g., RapCaviar)' },
            curatorName: { type: 'string', description: 'Optional curator name' }
        },
        required: ['releaseId', 'targetPlaylist']
    },
    handler: async () => {
        // Fail closed until the YAMNet fingerprint + artist bio pipeline ships (ISSUE-1089).
        // Same contract as pitch_story (ISSUE-911): no generated pitch without real analysis.
        return {
            isError: true,
            content: [{ type: 'text', text: 'generate_playlist_pitch is not implemented yet. No audio analysis was performed and no pitch was generated. This tool requires the YAMNet audio fingerprint and artist bio backend. Do not draft a pitch from placeholder data.' }]
        };
    }
};
