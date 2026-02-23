import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { GenAI } from '../../ai/GenAI';
import { StreamChunk } from '@/shared/types/ai.dto';

// Mock AI
vi.mock('../../ai/GenAI', () => ({
    GenAI: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn()
    },
    AI: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn()
    }
}));

vi.mock('../registry', () => ({
    agentRegistry: {
        getAsync: vi.fn()
    }
}));

// Mock Firebase Auth
vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user' },
        onAuthStateChanged: vi.fn(() => () => { })
    },
    db: {},
    remoteConfig: {
        fetchAndActivate: vi.fn().mockResolvedValue(true),
        getAll: vi.fn().mockReturnValue({}),
        getValue: vi.fn(),
        settings: {}
    }
}));

class VisionAgent extends BaseAgent {
    constructor() {
        super({
            id: 'video',
            name: 'Vision Expert',
            description: 'Can see images',
            systemPrompt: 'You are a vision expert.',
            category: 'specialist',
            color: 'bg-green-500',
            tools: [],
            functions: {}
        });
    }
}

describe('Agent Multimodal Support', () => {
    let agent: VisionAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new VisionAgent();
    });

    it('should include attachments in AI requests', async () => {
        const mockResponse = {
            response: {
                text: () => 'I see a red car.',
                candidates: [{ content: { parts: [{ text: 'I see a red car.' }] } }],
                usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
            }
        };

        (GenAI.generateContent as any).mockResolvedValue(mockResponse);

        const attachments = [
            { mimeType: 'image/jpeg', base64: 'base64-data-here' }
        ];

        const result = await agent.execute('What is in this image?', {}, undefined, undefined, attachments);

        // Verify AI call contains the image part
        expect(GenAI.generateContent).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    parts: expect.arrayContaining([
                        expect.objectContaining({ text: expect.stringContaining('What is in this image?') }),
                        expect.objectContaining({
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: 'base64-data-here'
                            }
                        })
                    ])
                })
            ]),
            expect.any(String), // model
            expect.any(Object), // config
            undefined,          // systemInstruction (passed as undefined in BaseAgent)
            expect.any(Array),  // tools
            expect.any(Object)  // options
        );

        expect(result.text).toBe('I see a red car.');
    });
});
