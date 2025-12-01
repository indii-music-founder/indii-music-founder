import { BaseAgent } from './BaseAgent';

export class MusicAgent extends BaseAgent {
    id = 'music';
    name = 'Music Supervisor';
    description = 'Handles audio analysis, track selection, and music generation prompts.';
    systemPrompt = `You are the Music Supervisor for a creative studio.
    Your role is to analyze audio requirements, suggest tracks, and generate prompts for music generation.
    You understand BPM, key, mood, and genre.
    Be precise about musical terminology.`;

    tools = [];
}
