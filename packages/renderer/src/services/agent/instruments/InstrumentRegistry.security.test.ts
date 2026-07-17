import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    imageExecute: vi.fn(),
    videoExecute: vi.fn(),
    callable: vi.fn().mockResolvedValue({ data: { success: true } }),
    httpsCallable: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
}));

vi.mock('./ImageGenerationInstrument', () => ({
    ImageGenerationInstrument: class {
        metadata = { id: 'generate_image', name: 'generate_image', description: 'generate_image' };
        inputs = [{ name: 'prompt', required: true }];
        outputs = [{ name: 'result' }];
        execute = mocks.imageExecute;
    },
}));

vi.mock('./VideoGenerationInstrument', () => ({
    VideoGenerationInstrument: class {
        metadata = { id: 'generate_video', name: 'generate_video', description: 'generate_video' };
        inputs = [{ name: 'prompt', required: true }];
        outputs = [{ name: 'result' }];
        execute = mocks.videoExecute;
    },
}));

vi.mock('@/services/cache/CacheService', () => ({ CacheService: class {} }));
vi.mock('@/services/firebase', () => ({ db: { name: 'db' }, functions: { name: 'functions' } }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ name: 'instrument_usage_stats' })),
    getDocs: mocks.getDocs,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));

import { instrumentRegistry } from './InstrumentRegistry';

describe('InstrumentRegistry secure aggregate writes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.httpsCallable.mockReturnValue(mocks.callable);
    });

    it('reports one successful execution through the server callable', async () => {
        mocks.imageExecute.mockResolvedValue({ success: true, data: {}, metadata: { executionTimeMs: 1 } });

        await instrumentRegistry.execute('generate_image', { prompt: 'cover art' });

        expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'recordInstrumentUsage');
        expect(mocks.callable).toHaveBeenCalledWith({
            instrumentId: 'generate_image',
            outcome: 'success',
            executionId: expect.any(String),
        });
    });

    it('reports a failed result without accepting client aggregate counters', async () => {
        mocks.videoExecute.mockResolvedValue({ success: false, error: 'provider failed', metadata: { executionTimeMs: 1 } });

        await instrumentRegistry.execute('generate_video', { prompt: 'video' });

        expect(mocks.callable).toHaveBeenCalledWith({
            instrumentId: 'generate_video',
            outcome: 'failed',
            executionId: expect.any(String),
        });
    });
});
