import path from 'path';
import fs from 'fs';

const SYSTEM_ROOTS = [
    '/etc', '/var', '/usr', '/bin', '/sbin', '/proc', '/sys', '/root', '/boot', '/dev',
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\$Recycle.Bin'
];

/**
 * Validates that a file path is safe to access for audio analysis.
 * Protections:
 * 1. Resolves symlinks (Prevent Symlink Attacks).
 * 2. Checks against System Roots (Prevent Arbitrary File Read of system files).
 * 3. Checks for Hidden Files (Prevent access to .ssh, .config, etc.).
 * 4. validates Extension.
 *
 * @param filePath The path provided by the renderer.
 * @returns The resolved, safe real path.
 * @throws Error if the path is unsafe.
 */
export function validateSafeAudioPath(filePath: string): string {
    // 1. Resolve Symlinks
    // This is the critical fix for the "Symlink to /etc/passwd" exploit.
    let realPath: string;
    try {
        realPath = fs.realpathSync(filePath);
    } catch (error) {
        // If file doesn't exist, we can't analyze it anyway.
        // We throw a generic error to avoid leaking existence of files we can't read?
        // Actually, realpathSync failing usually means it doesn't exist.
        throw new Error(`Security Violation: Invalid file path or access denied`);
    }

    // 2. Normalize
    const normalized = path.normalize(realPath);

    // 3. Block System Directories
    if (SYSTEM_ROOTS.some(root => normalized.startsWith(root))) {
        // Log the attempt for security auditing (in a real app)
        throw new Error(`Security Violation: Access to system directory is denied.`);
    }

    // 4. Block Hidden Files/Directories (e.g. ~/.ssh/id_rsa)
    // We iterate segments to catch /home/user/.ssh/secret.wav
    const segments = normalized.split(path.sep);
    if (segments.some(segment => segment.startsWith('.') && segment !== '.' && segment !== '..')) {
         throw new Error("Security Violation: Access to hidden files or directories is denied");
    }

    // 5. Extension Check
    const ext = path.extname(normalized).toLowerCase();
    const allowedExts = ['.wav', '.mp3', '.flac', '.ogg', '.aiff', '.aif', '.m4a'];
    if (!allowedExts.includes(ext)) {
        throw new Error(`Security Violation: Invalid file extension '${ext}'.`);
    }

    return realPath;
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
