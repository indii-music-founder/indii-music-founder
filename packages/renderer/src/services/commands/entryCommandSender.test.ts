import { describe, expect, it } from 'vitest';
import { displaySenderId } from './entryCommandSender';

describe('displaySenderId', () => {
    it('shows built-in and save-command replies as the Conductor', () => {
        expect(displaySenderId('connect-remote')).toBe('generalist');
        expect(displaySenderId('save-command')).toBe('generalist');
    });

    it('leaves real agents and unknown ids alone', () => {
        expect(displaySenderId('publicist')).toBe('publicist');
        expect(displaySenderId('unregistered-runtime-model')).toBe('unregistered-runtime-model');
        expect(displaySenderId(undefined)).toBeUndefined();
    });
});
