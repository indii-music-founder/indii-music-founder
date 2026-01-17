import fs from 'fs';
import path from 'path';

// Define Safe System Roots (Allow User directories, deny System)
const SYSTEM_ROOTS = [
    '/etc', '/var', '/usr', '/bin', '/sbin', '/proc', '/sys', '/root',
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'
];

const ALLOWED_AUDIO_EXTENSIONS = new Set([
    '.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg', '.m4a'
]);

/**
 * Validates that an audio file path is safe to access.
 * Enforces:
 * 1. Path existence (via realpath).
 * 2. No Symlink attacks (via realpath resolution).
 * 3. Extension whitelist.
 * 4. System Directory protection.
 *
 * @param filePath The raw path provided by the user/IPC.
 * @returns The resolved, safe absolute path.
 * @throws Error if the path is unsafe.
 */
export function validateSafeAudioPath(filePath: string): string {
    // 1. Resolve Path (Canonicalize & Resolve Symlinks)
    let resolvedPath: string;
    try {
        // This throws if file doesn't exist, which is also a security check (don't probe non-existent files)
        resolvedPath = fs.realpathSync(filePath);
    } catch (error) {
        throw new Error(`Security Violation: Invalid file path or file not found`);
    }

    // 2. Validate Extension (on the RESOLVED path to prevent tricks like image.jpg.exe)
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
        throw new Error(`Security Violation: File type '${ext}' is not allowed`);
    }

    // 3. Block System Directories
    if (SYSTEM_ROOTS.some(root => resolvedPath.startsWith(root))) {
        throw new Error(`Security Violation: Access to system directory '${resolvedPath}' is denied`);
    }

    // 4. Block Hidden Files (Optional, but good practice)
    const segments = resolvedPath.split(path.sep);
    if (segments.some(segment => segment.startsWith('.') && segment !== '.' && segment !== '..')) {
        throw new Error("Security Violation: Access to hidden files is denied");
    }

    return resolvedPath;
}
