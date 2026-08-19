import { describe, it, expect } from 'vitest';
import { describeFileSystemError } from '../FileSystemService';

// ISSUE-1390: "Failed to create file/folder" after painting was a dead-end
// alert. Rules proven (emulator, live ruleset): file_nodes writes require a
// verified non-anonymous session. These tests pin the actionable messages so
// a guest or expired session explains itself instead of looking broken.
describe('describeFileSystemError (ISSUE-1390)', () => {
    it('explains the guest limitation instead of a dead-end failure', () => {
        const msg = describeFileSystemError(
            { code: 'permission-denied' },
            { isAnonymous: true, uid: 'anon-1' },
            'create this file/folder'
        );
        expect(msg).toContain("guest");
        expect(msg).toContain("Sign in to save your work");
    });

    it('explains demo users the same way (no uid is treated as demo)', () => {
        const msg = describeFileSystemError(new Error('nope'), { isAnonymous: false, uid: 'founder-demo-uid' }, 'update this file/folder');
        expect(msg).toContain("guest");
    });

    it('tells a real user with permission-denied their session may have expired', () => {
        const msg = describeFileSystemError(
            { code: 'permission-denied' },
            { isAnonymous: false, uid: 'real-user' },
            'create this file/folder'
        );
        expect(msg).toContain("session may have expired");
        expect(msg).toContain("sign in again");
    });

    it('calls transient network failures temporary hiccups', () => {
        const msg = describeFileSystemError(
            { code: 'unavailable' },
            { isAnonymous: false, uid: 'real-user' },
            'create this file/folder'
        );
        expect(msg).toContain("temporary network hiccup");
    });

    it('falls back to a generic retry message', () => {
        const msg = describeFileSystemError(
            new Error('something else'),
            { isAnonymous: false, uid: 'real-user' },
            'move this item to trash'
        );
        expect(msg).toContain('Failed to move this item to trash');
    });
});
