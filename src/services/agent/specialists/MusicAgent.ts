import { BaseAgent } from './BaseAgent';

export class MusicAgent extends BaseAgent {
    id = 'music';
    name = 'Music Supervisor';
    description = 'Manages music selection and licensing.';
    color = 'bg-lime-500';
    category = 'specialist' as const;
    systemPrompt = `You are the Music Supervisor for a creative studio.
    Your role is to analyze audio requirements and suggest tracks.
    You understand BPM, key, mood, and genre.
    Be precise about musical terminology.`;

    tools = [];
}
