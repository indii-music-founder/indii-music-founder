import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mocks
const mockUserData = '/userData';
const mockTmpDir = '/tmp';
const mockDocuments = '/documents';
const mockIndiiOS = path.join(mockDocuments, 'IndiiOS');

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn((name: string) => {
            if (name === 'userData') return mockUserData;
            if (name === 'documents') return mockDocuments;
            return '';
        })
    }
}));

vi.mock('os', () => ({
    default: {
        tmpdir: () => mockTmpDir
    }
}));

vi.mock('fs', () => ({
    default: {
        realpathSync: vi.fn((p: string) => {
            // Allow test paths
            if (p.startsWith(mockUserData) ||
                p.startsWith(mockTmpDir) ||
                p.startsWith(mockDocuments) ||
                p.startsWith('/authorized')) {
                return p;
            }
            throw new Error(`ENOENT: no such file or directory, realpath '${p}'`);
        })
    }
}));

// We must also mock electron-log since we're verifying if log.error is called
vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

import { accessControlService } from './AccessControlService';
import log from 'electron-log';

describe('AccessControlService', () => {
    beforeEach(() => {
        // Reset the singleton state
        (accessControlService as any).authorizedPaths.clear();
        vi.clearAllMocks();
    });

    it('should deny arbitrary paths by default', () => {
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
        expect(accessControlService.verifyAccess('/nonexistent/file.txt')).toBe(false);
    });

    it('should log an error when grantAccess fails', () => {
        const resolveSpy = vi.spyOn(path, 'resolve').mockImplementationOnce(() => {
            throw new Error('Resolve failed');
        });

        accessControlService.grantAccess('/some/path');

        expect(resolveSpy).toHaveBeenCalled();
        expect(log.error).toHaveBeenCalledWith(
            expect.stringContaining('[AccessControl] Failed to grant access'),
            expect.any(Error)
        );
    });

    it('should use path.resolve as fallback when fs.realpathSync fails for allowed directories', async () => {
        const fs = await import('fs');
        const originalRealpathSync = (fs.default.realpathSync as any).getMockImplementation();

        (fs.default.realpathSync as any).mockImplementation((p: string) => {
            // Trigger failure during the allowRoots mapping map
            if (p === mockUserData) {
                throw new Error('realpathSync failed');
            }
            return originalRealpathSync(p);
        });

        const fileInUserData = path.join(mockUserData, 'config.json');

        // userData will fallback to path.resolve(userData), which is an allowed root.
        // Therefore verification should pass.
        expect(accessControlService.verifyAccess(fileInUserData)).toBe(true);

        // Ensure that our mock actually caught the error logic
        expect(fs.default.realpathSync).toHaveBeenCalledWith(mockUserData);

        // Reset the mock
        (fs.default.realpathSync as any).mockImplementation(originalRealpathSync);
    });

    it('should handle explicitly granted paths with a trailing separator', () => {
        const dirWithSep = '/authorized/dir-with-sep/';
        accessControlService.grantAccess(dirWithSep);
        expect(accessControlService.verifyAccess('/authorized/dir-with-sep/file.txt')).toBe(true);
    });

    it('should handle authorized roots with a trailing separator', async () => {
        const electron = await import('electron');
        const originalGetPath = (electron.app.getPath as any).getMockImplementation();

        (electron.app.getPath as any).mockImplementation((name: string) => {
            if (name === 'userData') return mockUserData + '/';
            if (name === 'documents') return mockDocuments + '/';
            return '';
        });

        expect(accessControlService.verifyAccess(path.join(mockUserData, 'config.json'))).toBe(true);

        (electron.app.getPath as any).mockImplementation(originalGetPath);
    });

    it('should handle explicitly granted files that end with path separator logic gracefully', () => {
        const file = '/authorized/weird-file';
        accessControlService.grantAccess(file);
        expect(accessControlService.verifyAccess(file)).toBe(true);

        const fileWithSep = '/authorized/weird-file/';
        accessControlService.grantAccess(fileWithSep);
        expect(accessControlService.verifyAccess(fileWithSep)).toBe(true);
    });

    it('should deny paths that prefix match but are not in the directory', () => {
        const dir = '/authorized/dir';
        accessControlService.grantAccess(dir);
        expect(accessControlService.verifyAccess('/authorized/dir-suffix/file.txt')).toBe(false);
    });
});
