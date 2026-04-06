import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

class AccessControlService {
    private authorizedPaths: Set<string> = new Set();

    constructor() {
        console.log('[AccessControl] Initialized');
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
            console.log(`[AccessControl] Access granted: ${resolved}`);
        } catch (error) {
            console.error(`[AccessControl] Failed to grant access to ${filePath}:`, error);
        }
    }

    /**
     * Verifies if the file path is authorized for access.
     * Access is authorized if:
     * 1. The path was explicitly granted access (e.g. via file dialog).
     * 2. The path is within the App's User Data directory.
     * 3. The path is within the OS Temporary Directory.
     * 4. The path is within the App's Documents/IndiiOS directory.
     */
    verifyAccess(filePath: string): boolean {
        try {
            // 1. Resolve Path (Canonicalize & Resolve Symlinks)
            // This throws if file doesn't exist.
            // If the file allows "read", it must exist.
            // If we are checking "write" permission to a non-existent file, this would fail.
            // But verifyAccess is mostly used for "read" (transmit, analyze, stage).
            // For "save" (write), we usually grant access explicitly or use allowed dirs.
            // So fs.realpathSync is correct for preventing symlink attacks.
            const resolvedPath = fs.realpathSync(filePath);

            // 2. Check Explicit Grants
            // We check if the authorized paths set contains this specific file
            // OR if an authorized path is a parent directory of this file (if we granted directory access)
            for (const authorized of this.authorizedPaths) {
                // Determine if authorized path implies directory access
                // If we granted access to a directory, we allow children.
                // If we granted access to a file, we allow exact match.

                // We don't know if 'authorized' was a file or dir at grant time without stating it.
                // But usually selectDirectory grants a dir, selectFile grants a file.
                // Let's assume strict prefix check handles both (file starts with dir/).
                // But file starts with file/ is false.
                // So we need: resolvedPath === authorized OR resolvedPath.startsWith(authorized + separator)

                const authorizedWithSep = authorized.endsWith(path.sep) ? authorized : authorized + path.sep;
                if (resolvedPath === authorized || resolvedPath.startsWith(authorizedWithSep)) {
                    return true;
                }
            }

            // 3. Check System Allowlist
            // We assume app is ready when this is called.
            const allowedRoots = [
                app.getPath('userData'),
                os.tmpdir(),
                path.join(app.getPath('documents'), 'IndiiOS')
            ].map(p => {
                 try {
                    // Try to resolve root to handle symlinks (e.g. /var/tmp -> /private/var/tmp)
                    return fs.realpathSync(p);
                } catch (_e) {
                    // Fallback if root doesn't exist yet (unlikely for these standard dirs)
                    return path.resolve(p);
                }
            });

            const isAllowed = allowedRoots.some(root => {
                const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
                return resolvedPath === root || resolvedPath.startsWith(rootWithSep);
            });

            if (isAllowed) return true;

            console.warn(`[AccessControl] Access denied: ${resolvedPath}`);
            return false;

        } catch (error) {
            // If realpathSync fails (file not found), we deny access because we can't verify it.
            console.error(`[AccessControl] Verification failed for ${filePath}:`, error);
            return false;
        }
    }
}

export const accessControlService = new AccessControlService();
