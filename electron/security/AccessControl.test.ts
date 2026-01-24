import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mocks
const mockUserData = '/userData';
const mockTmpDir = '/tmp';
const mockDocuments = '/documents';
const mockIndiiOS = path.join(mockDocuments, 'IndiiOS');

vi.mock('electron', () => ({
    app: {
        getPath: (name: string) => {
            if (name === 'userData') return mockUserData;
            if (name === 'documents') return mockDocuments;
            return '';
        }
    }
}));

vi.mock('os', () => ({
    default: {
        tmpdir: () => mockTmpDir
    }
}));

vi.mock('fs', () => ({
    default: {
        realpathSync: (p: string) => {
            // Simulate existence for our test paths
            // We strip any symlink logic for this mock, assuming inputs are canonical for the test cases
            // or the mock returns the canonical path.

            // Allow test paths
            if (p.startsWith(mockUserData) ||
                p.startsWith(mockTmpDir) ||
                p.startsWith(mockDocuments) ||
                p.startsWith('/authorized')) {
                return p;
            }
            throw new Error(`ENOENT: no such file or directory, realpath '${p}'`);
        }
    }
}));

import { accessControlService } from './AccessControlService';

describe('AccessControlService', () => {
    beforeEach(() => {
        // Reset the singleton state
        (accessControlService as any).authorizedPaths.clear();
    });

    it('should deny arbitrary paths by default', () => {
        // /random/file.txt is not in allowlist mock, so realpathSync throws, verifying deny logic handles errors
        expect(accessControlService.verifyAccess('/random/file.txt')).toBe(false);
    });

    it('should allow paths in userData', () => {
        expect(accessControlService.verifyAccess(path.join(mockUserData, 'config.json'))).toBe(true);
    });

    it('should allow paths in tmpdir', () => {
        expect(accessControlService.verifyAccess(path.join(mockTmpDir, 'staged/file.txt'))).toBe(true);
    });

    it('should allow paths in Documents/IndiiOS', () => {
        expect(accessControlService.verifyAccess(path.join(mockIndiiOS, 'Assets/Video/movie.mp4'))).toBe(true);
    });

    it('should deny paths in Documents outside IndiiOS', () => {
        // Documents itself is mocked to exist, so realpath works.
        // But logic should deny it.
        expect(accessControlService.verifyAccess(path.join(mockDocuments, 'secret.txt'))).toBe(false);
    });

    it('should allow explicitly granted files', () => {
        const file = '/authorized/file.txt';
        accessControlService.grantAccess(file);
        expect(accessControlService.verifyAccess(file)).toBe(true);
    });

    it('should allow files in explicitly granted directories', () => {
        const dir = '/authorized/dir';
        accessControlService.grantAccess(dir);
        expect(accessControlService.verifyAccess(path.join(dir, 'file.txt'))).toBe(true);
    });

    it('should deny files that do not exist (realpath failure)', () => {
        // /nonexistent/file.txt -> realpath throws -> returns false
        expect(accessControlService.verifyAccess('/nonexistent/file.txt')).toBe(false);
    });
});
