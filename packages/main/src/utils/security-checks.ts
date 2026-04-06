import path from 'path';
import fs from 'fs';

const SYSTEM_ROOTS = [
    '/etc', '/var', '/usr', '/bin', '/sbin', '/proc', '/sys', '/root',
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'
];

const MEDIA_EXTENSIONS = new Set([
    '.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg', '.m4a',
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.xml', '.txt', '.json', '.zip', '.itmsp'
]);

const KEY_EXTENSIONS = new Set([
    '.pem', '.key', '.ppk'
]);

export function validateSafeDistributionSource(filePath: string, options: { allowKeys?: boolean } = {}): void {
    // 1. Resolve Path (Canonicalize & Resolve Symlinks) to prevent LFI via symlinks
    let resolvedPath: string;
    try {
        resolvedPath = fs.realpathSync(filePath);
    } catch (_error) {
        throw new Error(`Security Violation: Invalid file path or file not found`);
    }

    // 2. Normalize Path
    const normalized = path.normalize(resolvedPath);

    // 3. Check for Path Traversal (redundant with realpath, but defense in depth)
    if (normalized.includes('..')) {
        throw new Error("Security Violation: Path traversal detected");
    }

    // 4. Block Hidden Files and Directories
    // We split by the OS separator. On Windows this is '\', on Linux '/'.
    const segments = normalized.split(path.sep);
    if (segments.some(segment => segment.startsWith('.') && segment !== '.' && segment !== '..')) {
        throw new Error("Security Violation: Access to hidden files or directories is denied");
    }

    // 5. Block System Directories
    if (SYSTEM_ROOTS.some(root => normalized.startsWith(root))) {
        throw new Error("Security Violation: Access to system directories is denied");
    }

    // 6. Enforce Extension Whitelist
    const ext = path.extname(normalized).toLowerCase();

    let allowed = MEDIA_EXTENSIONS.has(ext);
    if (options.allowKeys && KEY_EXTENSIONS.has(ext)) {
        allowed = true;
    }

    if (!allowed) {
        throw new Error(`Security Violation: File type '${ext}' is not allowed for distribution`);
    }
}
