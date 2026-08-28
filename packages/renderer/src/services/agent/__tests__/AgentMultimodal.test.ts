import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { AutonomousIntelligence } from '../../intelligence/AutonomousIntelligence';
// Mock AI
vi.mock('../../intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
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
    },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Compression must fail closed-to-original in this harness: the guard fails
// OPEN (keeps the raw attachment) and the payload budget assert decides.
vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        compressImage: vi.fn().mockRejectedValue(new Error('canvas unavailable in test')),
    },
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

    it('should include attachments in Autonomous requests', async () => {
        const mockResponse = {
            response: {
                text: () => 'I see a red car.',
                candidates: [{ content: { parts: [{ text: 'I see a red car.' }] } }],
                usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
            }
        };

        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        const attachments = [
            { mimeType: 'image/jpeg', base64: 'base64-data-here' }
        ];

        const result = await agent.execute('What is in this image?', {}, undefined, undefined, attachments);

        // Verify Autonomous call contains the image part
        expect(AutonomousIntelligence.generateContent).toHaveBeenCalledWith(
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

    it('halts controlled with a specific payload error when attachments exceed the stream budget (ERROR_LEDGER 2026-08-27)', async () => {
        const result = await agent.execute(
            'Render this logo',
            {},
            undefined,
            undefined,
            [{ mimeType: 'image/png', base64: 'A'.repeat(250_000) }]
        );

        expect(result.error).toBe('Payload Too Large');
        expect(result.text).toContain('Task halted');
        expect(result.text).toContain('200KB');
        // Decisive: the oversize request never reached the model layer.
        expect(AutonomousIntelligence.generateContentStream).not.toHaveBeenCalled();
        expect(AutonomousIntelligence.generateContent).not.toHaveBeenCalled();
    });
});
