import { describe, it, expect } from 'vitest';
import { isUserCancellation, errorText } from '@/services/agent/flowFailure';
import { AppErrorCode, AppException } from '@/shared/types/errors';

describe('isUserCancellation (ISSUE-1667)', () => {
    it('treats an aborted run signal as a user stop, even when the thrown value is the string reason', () => {
        const controller = new AbortController();
        controller.abort('User requested stop');
        let thrown: unknown;
        try { controller.signal.throwIfAborted(); } catch (err) { thrown = err; }
        expect(thrown).toBe('User requested stop');
        expect(isUserCancellation(thrown, controller.signal)).toBe(true);
    });

    it('recognises cancellation errors without a signal', () => {
        expect(isUserCancellation(new AppException(AppErrorCode.CANCELLED, 'AI Request was cancelled by user'))).toBe(true);
        expect(isUserCancellation(new DOMException('Aborted', 'AbortError'))).toBe(true);
    });

    it('does not hide real failures', () => {
        expect(isUserCancellation(new Error('network down'), new AbortController().signal)).toBe(false);
        expect(isUserCancellation(new AppException(AppErrorCode.TIMEOUT, 'timed out'))).toBe(false);
    });
});

describe('errorText', () => {
    it('reads messages from Error and string throws', () => {
        expect(errorText(new Error('boom'))).toBe('boom');
        expect(errorText('plain string')).toBe('plain string');
        expect(errorText(undefined)).toBe('');
    });
});
