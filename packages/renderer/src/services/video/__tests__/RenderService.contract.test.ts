/**
 * Legacy Remotion-path adapter compliance (MIG-006).
 * Runs the SHARED VideoRendererContract suite against RenderService with a
 * stubbed Firebase callable transport — proving the suite fits the incumbent.
 */

import { beforeEach, describe, expect, vi } from 'vitest';

import { runVideoRendererContractSuite } from '../../../../../shared/src/testing/videoRendererSuite';
import type { RendererContractScenario } from '../../../../../shared/src/testing/videoRendererSuite';

import { RenderService } from '../RenderService';

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));
vi.mock('@/services/firebase', () => ({ functions: {} }));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

interface StubState {
    readonly receipts: Map<string, { status: string; error?: string }>;
    seq: number;
}

// Local helper types keep the stub honest without importing production internals.
type Payload = Record<string, unknown>;

const makeStubInvoker = (state: StubState) =>
    vi.fn(async (_name: string, payload: Payload) => {
        if (_name === 'renderVideo') {
            const projectId = String(payload['projectId'] ?? '');
            const inputProps = payload['inputProps'] as Record<string, unknown> | undefined;
            if (!payload['projectId']) throw new Error('projectId is required');
            void organizationGuard(payload);
            if (!inputProps?.project || typeof inputProps.project !== 'object') {
                throw new Error('A canonical compiled video project is required.');
            }
            state.seq += 1;
            const renderId = `stub_${state.seq}`;
            state.receipts.set(renderId, { status: 'running' });
            return { success: true, renderId, projectId };
        }
        if (_name === 'getVideoRenderReceipt') {
            const jobId = String(payload['jobId'] ?? '');
            const receipt = state.receipts.get(jobId);
            if (!receipt) throw new Error('unknown render');
            if (receipt.status === 'completed') {
                return {
                    status: 'completed',
                    renderId: jobId,
                    projectId: 'proj-1',
                    progress: 100,
                    asset: {
                        url: 'https://storage.example.com/signed/out.mp4',
                        expiresAt: Date.now() + 3_600_000,
                        generation: '1234567890',
                        mimeType: 'video/mp4',
                    },
                };
            }
            if (receipt.status === 'failed') {
                return {
                    status: 'failed', renderId: jobId, projectId: 'proj-1',
                    progress: 40, error: receipt.error ?? 'unknown-failure',
                };
            }
            return { status: 'running', renderId: jobId, projectId: 'proj-1', progress: 10 };
        }
        throw new Error(`unexpected callable ${_name}`);
    });

const organizationGuard = (payload: Payload): boolean => {
    if (!payload['organizationId']) throw new Error('organizationId is required');
    return true;
};

describe('RenderService legacy adapter', () => {
    let state: StubState;

    beforeEach(() => {
        state = { receipts: new Map(), seq: 0 };
    });

    runVideoRendererContractSuite('RenderService (Remotion path)', (): RendererContractScenario => {
        const invoker = makeStubInvoker(state);
        const service = new RenderService(
            invoker as unknown as ConstructorParameters<typeof RenderService>[0],
            () => Promise.resolve(),
        );
        const lastId = () => `stub_${state.seq}`;
        return {
            makeAdapter: () => service,
            baseConfig: () => ({
                compositionId: 'Showreel',
                outputLocation: 'out.mp4',
                projectId: 'proj-1',
                organizationId: 'org-1',
                inputProps: { project: { id: 'proj-1' } },
                useCloudQueue: true,
            }),
            complete: async (renderId) => {
                expect(renderId).toBe(lastId());
                state.receipts.set(renderId, { status: 'completed' });
            },
            fail: async (renderId, message) => {
                state.receipts.set(renderId, { status: 'failed', error: message });
            },
        };
    });
});
