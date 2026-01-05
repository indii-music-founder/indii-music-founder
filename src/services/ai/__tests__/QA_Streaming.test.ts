import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAIService } from '../FirebaseAIService';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    functions: {},
    ai: {},
    remoteConfig: {},
    db: {},
    auth: { currentUser: { uid: 'user-stream' } }
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    increment: vi.fn(),
    serverTimestamp: vi.fn(),
    collection: vi.fn()
}));

vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn(() => ({ asString: () => '' }))
}));

// Mock firebase/ai wrapped
const mockGenerateContentStream = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock('firebase/ai', () => ({
    __esModule: true,
    getGenerativeModel: vi.fn(() => ({
        generateContentStream: mockGenerateContentStream,
        generateContent: mockGenerateContent
    })),
    Schema: {},
    Tool: {}
}));

describe('Streaming QA', () => {
    let service: FirebaseAIService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new FirebaseAIService();
    });

    it('should pass AbortSignal to SDK', async () => {
        const mockStream = {
            [Symbol.asyncIterator]: async function* () {
                yield {
                    text: () => 'Chunk',
                    candidates: [{ content: { parts: [{ text: 'Chunk' }] } }]
                };
            }
        };

        mockGenerateContentStream.mockResolvedValue({
            stream: mockStream,
            response: Promise.resolve({ text: () => 'Full' })
        });

        const controller = new AbortController();
        const signal = controller.signal;

        await service.generateContentStream('prompt', undefined, {}, undefined, undefined, { signal });

        expect(mockGenerateContentStream).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ signal })
        );
    });

    it('should tolerate chunk errors', async () => {
        const mockStream = {
            [Symbol.asyncIterator]: async function* () {
                yield {
                    text: () => 'Good',
                    candidates: [{ content: { parts: [{ text: 'Good' }] } }]
                };
                yield {
                    text: () => { throw new Error('Bad'); },
                    candidates: []
                };
            }
        };

        mockGenerateContentStream.mockResolvedValue({
            stream: mockStream,
            response: Promise.resolve({})
        });

        const { stream } = await service.generateContentStream('prompt');
        const reader = stream.getReader();

        const r1 = await reader.read();
        expect(r1.value.text()).toBe('Good');

        const r2 = await reader.read();
        expect(r2.value.text()).toBe(''); // Should catch error and return empty string
    });
});
