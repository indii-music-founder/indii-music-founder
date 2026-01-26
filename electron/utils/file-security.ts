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
import os from 'os';
import { app } from 'electron';

// Define Safe System Roots (Allow User directories, deny System)
const SYSTEM_ROOTS = [
    '/etc', '/var', '/usr', '/bin', '/sbin', '/proc', '/sys', '/root',
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'
];

const ALLOWED_AUDIO_EXTENSIONS = new Set([
    '.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg', '.m4a'
]);

const ALLOWED_VIDEO_EXTENSIONS = new Set([
    '.mp4', '.webm', '.mov', '.avi', '.mkv'
]);

/**
 * Validates that a video output path is safe to write to.
 * Enforces:
 * 1. Extension whitelist.
 * 2. Parent directory existence and safety (via realpath).
 * 3. Containment within allowed roots.
 *
 * @param filePath The raw output path.
 * @param allowedRoots List of allowed root directories (absolute paths).
 * @returns The resolved, safe absolute path.
 * @throws Error if the path is unsafe.
 */
export function validateSafeVideoOutputPath(filePath: string, allowedRoots: string[]): string {
    // 1. Validate Extension
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
        throw new Error(`Security Violation: File type '${ext}' is not allowed`);
    }

    // 2. Resolve Parent Path (Canonicalize & Resolve Symlinks)
    const dir = path.dirname(filePath);
    let resolvedDir: string;
    try {
        resolvedDir = fs.realpathSync(dir);
    } catch {
        throw new Error(`Security Violation: Parent directory does not exist or is inaccessible`);
    }

    // 3. Verify Containment in Allowed Roots
    const resolvedRoots = allowedRoots.map(root => {
        try {
            return fs.realpathSync(root);
        } catch {
            return root;
        }
    });

    const isAllowed = resolvedRoots.some(root => {
        const safeRoot = root.endsWith(path.sep) ? root : root + path.sep;
        return resolvedDir === root || resolvedDir.startsWith(safeRoot);
    });

    if (!isAllowed) {
        throw new Error(`Security Violation: Output directory '${resolvedDir}' is not in an allowed location`);
    }

    // 4. Block Hidden Files/Dirs in the filename part
    const filename = path.basename(filePath);
    if (filename.startsWith('.')) {
        throw new Error("Security Violation: Hidden files are not allowed");
    }

    // Reconstruct the full path using the safe directory and validated filename
    return path.join(resolvedDir, filename);
}

    '.mp4', '.webm', '.mov'
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
    } catch {
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

/**
 * Validates that a video output path is safe to write to.
 * Does NOT require file existence (since we are writing).
 * Enforces:
 * 1. Allowed Extensions.
 * 2. Path Containment (must be in Documents/IndiiOS, UserData, or Temp).
 * 3. No System Directories.
 */
export function validateSafeVideoOutputPath(filePath: string): string {
    // 1. Resolve Path (Canonicalize)
    // We use resolve, not realpathSync, because file might not exist.
    const resolvedPath = path.resolve(filePath);

    // 2. Validate Extension
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
        throw new Error(`Security Violation: Output file type '${ext}' is not allowed`);
    }

    // 3. Block System Directories (Explicit Denylist)
    if (SYSTEM_ROOTS.some(root => resolvedPath.startsWith(root))) {
        throw new Error(`Security Violation: Write access to system directory '${resolvedPath}' is denied`);
    }

    // 4. Enforce Containment (Allowlist)
    // We want to ensure we are writing to expected locations.
    const allowedRoots = [
        path.join(app.getPath('documents'), 'IndiiOS'),
        app.getPath('userData'),
        os.tmpdir()
    ].map(p => path.resolve(p)); // Ensure roots are resolved

    const isAllowed = allowedRoots.some(root => {
        // Check if resolvedPath is inside root
        // Add separator to ensure we don't match partial folder names (e.g. /tmp vs /tmp_evil)
        const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
        return resolvedPath === root || resolvedPath.startsWith(rootWithSep);
    });

    if (!isAllowed) {
         throw new Error(`Security Violation: Output path '${resolvedPath}' is outside allowed directories`);
    }

    return resolvedPath;
}
