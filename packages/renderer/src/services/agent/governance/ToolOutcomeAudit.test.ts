import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpsCallable } from 'firebase/functions';
import { recordToolOutcome } from './ToolOutcomeAudit';

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));
vi.mock('@/services/firebase', () => ({ functions: {} }));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn() } }));

// Structural service boundary tests; no genuine-account or deployed audit claim.
describe('tool outcome audit', () => {
    const outcome = { userId: 'owner', agentId: 'conductor', toolName: 'publish', toolCallId: 'invocation-1', success: true };
    const write = Object.assign(vi.fn(), { stream: vi.fn() });
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(httpsCallable).mockReturnValue(write);
    });
    it('waits for the server acknowledgement and returns its durable document ID', async () => {
        let acknowledge!: (value: { data: { logId: string } }) => void;
        write.mockReturnValue(new Promise(resolve => { acknowledge = resolve; }));
        const settled = vi.fn();
        const pending = recordToolOutcome(outcome).then(settled);
        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();
        expect(write).toHaveBeenCalledWith({ action: 'agent.tool.publish', resourceId: 'agent/conductor', severity: 'low', agentId: 'conductor', status: 'success', details: 'toolCallId=invocation-1' });
        acknowledge({ data: { logId: ' saved-audit ' } });
        await pending;
        expect(settled).toHaveBeenCalledWith({ status: 'confirmed', logId: 'saved-audit' });
        expect(httpsCallable).toHaveBeenCalledWith({}, 'logAuditEvent', { timeout: 10_000 });
    });
    it('records failures and identity provenance without transmitting browser ownership', async () => {
        write.mockResolvedValue({ data: { logId: 'failure-audit' } });
        expect(await recordToolOutcome({ ...outcome, success: false, fingerprint: 'fingerprint' })).toEqual({ status: 'confirmed', logId: 'failure-audit' });
        expect(write.mock.calls[0][0]).toMatchObject({ status: 'failure', severity: 'medium', details: 'toolCallId=invocation-1;agentFingerprint=fingerprint' });
        expect(write.mock.calls[0][0]).not.toHaveProperty('userId');
    });
    it('retains uncertainty on a lost acknowledgement without retrying', async () => {
        write.mockRejectedValue(new Error('response lost'));
        expect(await recordToolOutcome(outcome)).toEqual({ status: 'unconfirmed' });
        expect(write).toHaveBeenCalledTimes(1);
    });
    it.each([undefined, {}, { logId: '' }, { logId: 7 }, { logId: '   ' }])('rejects incomplete acknowledgement %j', async data => {
        write.mockResolvedValue({ data });
        expect(await recordToolOutcome(outcome)).toEqual({ status: 'unconfirmed' });
    });
    it('preserves outcome handling when callable construction throws', async () => {
        vi.mocked(httpsCallable).mockImplementation(() => { throw new Error('unavailable'); });
        expect(await recordToolOutcome(outcome)).toEqual({ status: 'unconfirmed' });
    });
    it('explicitly marks missing authentication context unavailable', async () => {
        expect(await recordToolOutcome({ ...outcome, userId: undefined })).toEqual({ status: 'unavailable' });
        expect(write).not.toHaveBeenCalled();
    });
});
