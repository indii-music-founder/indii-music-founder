import { AgentConfig } from '../types';
import { MusicTools } from '../tools/MusicTools';
import systemPrompt from '@agents/music/prompt.md?raw';

export const MusicAgent: AgentConfig = {
    id: 'music',
    name: 'Music Supervisor',
    description: 'Manages music selection and licensing.',
    color: 'bg-lime-500',
    category: 'specialist',
    systemPrompt,
    functions: {
        analyze_audio: MusicTools.analyze_audio,
        get_audio_metadata: MusicTools.get_audio_metadata
    },
    tools: [{
        functionDeclarations: [{
            name: 'analyze_audio',
            description: 'Analyze an audio file for BPM, key, energy, and mood.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    filePath: { type: 'STRING', description: 'Absolute path to the audio file.' }
                },
                required: ['filePath']
            }
        }, {
            name: 'get_audio_metadata',
            description: 'Retrieve metadata for an audio file using its hash.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    hash: { type: 'STRING', description: 'The unique hash of the audio file.' }
                },
                required: ['hash']
            }
        }]
    }]
};
