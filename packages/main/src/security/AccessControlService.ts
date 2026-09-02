import log from 'electron-log';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

class AccessControlService {
    private authorizedPaths: Set<string> = new Set();

    constructor() {
        log.info('[AccessControl] Initialized');
    }

    /**
     * Grants access to a specific file path during the current session.
     */
    grantAccess(filePath: string): void {
        try {
            // We resolve to absolute path to avoid ambiguity
            // Note: We don't use realpathSync here because we might be granting access to a file
            // that doesn't exist yet (e.g. save dialog target), although usually save dialog ensures existence or we create it.
            // Actually, for save dialog, we get the path back. The file might not exist yet if we haven't written it.
            // So path.resolve is safer for grant.
            const resolved = path.resolve(filePath);
            this.authorizedPaths.add(resolved);
            log.info(`[AccessControl] Access granted: ${resolved}`);
        } catch (error) {
            log.error(`[AccessControl] Failed to grant access to ${filePath}:`, error);
        }
    }

    private getAllowedRoots(): string[] {
        const homeDir = typeof os.homedir === 'function' ? os.homedir() : '';
        const roots = [
            app.getPath('userData'),
            os.tmpdir(),
            path.join(app.getPath('documents'), 'indii'),
            ...(homeDir ? [path.join(homeDir, 'indii')] : [])
        ];

        return roots.map(p => {
            try {
                // Try to resolve root to handle symlinks (e.g. /var/tmp -> /private/var/tmp)
                return fs.realpathSync(p);
            } catch (_e) {
                // Fallback if root doesn't exist yet (unlikely for these standard dirs)
                return path.resolve(p);
            }
        });
    }

    /**
     * Checks whether a resolved path is within the allowed roots.
     */
    isWithinAllowedRoots(targetPath: string): boolean {
        const allowedRoots = this.getAllowedRoots();
        return allowedRoots.some(root => {
            const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
            return targetPath === root || targetPath.startsWith(rootWithSep);
        });
    }

    /**
     * Verifies if the file path is authorized for access.
     * Access is authorized if:
     * 1. The path was explicitly granted access (e.g. via file dialog).
     * 2. The path is within the App's User Data directory.
     * 3. The path is within the OS Temporary Directory.
     * 4. The path is within the App's Documents/indii directory.
     * 5. The path is within the User's ~/indii directory.
     */
    verifyAccess(filePath: string): boolean {
        try {
            // 1. Resolve Path (Canonicalize & Resolve Symlinks)
            const resolvedPath = fs.realpathSync(filePath);

            // 2. Check Explicit Grants
            for (const authorized of this.authorizedPaths) {
                const authorizedWithSep = authorized.endsWith(path.sep) ? authorized : authorized + path.sep;
                if (resolvedPath === authorized || resolvedPath.startsWith(authorizedWithSep)) {
                    return true;
                }
            }

            // 3. Check System Allowlist
            if (this.isWithinAllowedRoots(resolvedPath)) return true;

            log.warn(`[AccessControl] Access denied: ${resolvedPath}`);
            return false;

        } catch (error) {
            // If realpathSync fails (file not found), we deny access because we can't verify it.
            log.error(`[AccessControl] Verification failed for ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Verifies a WRITE target whose file does not exist yet (render output, export, save).
     *
     * `verifyAccess` canonicalizes the file itself, so it cannot be used here — a
     * not-yet-created file makes `realpathSync` throw and the check returns false.
     * This resolves the *parent directory* instead, which must already exist, then
     * applies the same grant + allowlist scope rules.
     *
     * Resolving the parent is what defeats a symlink attack: a path containing no
     * `..` at all (so a literal string check waves it through) can still sit inside
     * a directory that is itself a symlink pointing somewhere sensitive.
     * (ISSUE-1282 — this scope check was previously a no-op block in video:render.)
     */
    verifyWriteTargetDirectory(filePath: string): boolean {
        try {
            const parentDir = path.dirname(path.resolve(filePath));
            // Throws if the parent directory doesn't exist — we deny rather than guess.
            const resolvedDir = fs.realpathSync(parentDir);

            for (const authorized of this.authorizedPaths) {
                const authorizedWithSep = authorized.endsWith(path.sep) ? authorized : authorized + path.sep;
                if (resolvedDir === authorized || resolvedDir.startsWith(authorizedWithSep)) {
                    return true;
                }
            }

            const isAllowed = this.isWithinAllowedRoots(resolvedDir);

            if (!isAllowed) {
                log.warn(`[AccessControl] Write target denied — resolved directory outside allowed scope: ${resolvedDir}`);
            }
            return isAllowed;
        } catch (error) {
            log.error(`[AccessControl] Write target verification failed for ${filePath}:`, error);
            return false;
        }
    }
}

export const accessControlService = new AccessControlService();
