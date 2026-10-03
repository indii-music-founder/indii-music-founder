import type { BlenderTemplateId, BlenderTemplateInfo } from './types.js';

export const BLENDER_TEMPLATES: Record<BlenderTemplateId, BlenderTemplateInfo> = {
    audio_reactive_tunnel: {
        id: 'audio_reactive_tunnel',
        name: 'Audio-Reactive Cyber Tunnel',
        description: 'Infinite geometric warp tunnel flying forward synced to song BPM. Neon rings and walls pulse with sub-bass and kick drums.',
        recommendedAspectRatio: '16:9',
        defaultDurationSeconds: 30,
        supportsCoverArt: false,
        supportsCustomText: true,
        tags: ['electronic', 'techno', 'hip-hop', 'trap', 'neon', 'cyberpunk', 'visualizer']
    },
    vinyl_turntable: {
        id: 'vinyl_turntable',
        name: '3D Vinyl Record Turntable Showcase',
        description: 'Photorealistic spinning 12" vinyl record on an audiophile turntable with the artist album art on the center label and outer sleeve.',
        recommendedAspectRatio: '16:9',
        defaultDurationSeconds: 30,
        supportsCoverArt: true,
        supportsCustomText: true,
        tags: ['vinyl', 'turntable', 'album-art', 'analog', 'lo-fi', 'r&b', 'indie', 'photorealistic']
    },
    chrome_text: {
        id: 'chrome_text',
        name: '3D Liquid Chrome & Metallic Typography',
        description: 'Extruded high-gloss liquid chrome 3D typography of artist name and song title floating in zero-gravity with studio reflections and audio shockwaves.',
        recommendedAspectRatio: '9:16',
        defaultDurationSeconds: 15,
        supportsCoverArt: false,
        supportsCustomText: true,
        tags: ['chrome', 'typography', 'y2k', 'futuristic', 'metal', 'shorts', 'tiktok', 'canvas']
    },
    spectrum_bars: {
        id: 'spectrum_bars',
        name: '3D Circular Audio Spectrum Waveform',
        description: 'Circular 3D geometric equalizer bars undulating around a central pulsating orb, directly mapped to audio frequency bins.',
        recommendedAspectRatio: '1:1',
        defaultDurationSeconds: 30,
        supportsCoverArt: true,
        supportsCustomText: false,
        tags: ['equalizer', 'spectrum', 'audio-reactive', 'edm', 'podcast', 'square']
    },
    concert_stage: {
        id: 'concert_stage',
        name: 'Virtual Concert Stage & Moving-Head Spotlights',
        description: '3D concert arena stage with robotic moving-head beams, laser sweeps, and LED video backdrop reacting to audio energy.',
        recommendedAspectRatio: '16:9',
        defaultDurationSeconds: 30,
        supportsCoverArt: true,
        supportsCustomText: true,
        tags: ['live', 'concert', 'stage', 'spotlights', 'arena', 'festival', 'lighting']
    }
};

export function listAvailableTemplates(): BlenderTemplateInfo[] {
    return Object.values(BLENDER_TEMPLATES);
}

export function getTemplateInfo(id: BlenderTemplateId): BlenderTemplateInfo | null {
    return BLENDER_TEMPLATES[id] ?? null;
}
