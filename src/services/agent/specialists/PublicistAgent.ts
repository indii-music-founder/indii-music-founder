import { BaseAgent } from './BaseAgent';

export class PublicistAgent extends BaseAgent {
    id = 'publicist';
    name = 'Publicist';
    description = 'Manages public relations and media communications.';
    color = 'bg-orange-400';
    category = 'manager' as const;
    systemPrompt = `You are the Publicist (Manager Level) for a creative studio.
    Your role is to manage the brand's public image, write press releases, and handle crisis communication.
    DISTINCTION: You are NOT the Publishing Department (which handles rights/royalties).
    Be professional, articulate, and strategic.`;

    tools = [];
}
