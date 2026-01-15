import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { AI } from '../../ai/AIService';
import { WrappedResponse, StreamChunk } from '@/shared/types/ai.dto';

// Mock AI
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateContentStream: vi.fn()
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
        currentUser: { uid: 'test-user' }
    },
    db: {}
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
        const mockStream = new ReadableStream<StreamChunk>({
            start(controller) {
                controller.close();
            }
        });

        const mockResponse: WrappedResponse = {
            response: {} as any,
            text: () => 'I see a red car.',
            functionCalls: () => [],
            usage: () => undefined
        };

        (AI.generateContentStream as any).mockResolvedValue({
            stream: mockStream,
            response: Promise.resolve(mockResponse)
        });

        const attachments = [
            { mimeType: 'image/jpeg', base64: 'base64-data-here' }
        ];

        const result = await agent.execute('What is in this image?', {}, undefined, undefined, attachments);

        // Verify AI call contains the image part
        expect(AI.generateContentStream).toHaveBeenCalledWith(expect.objectContaining({
            contents: [
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
            ]
        }));

        expect(result.text).toBe('I see a red car.');
    });
});
