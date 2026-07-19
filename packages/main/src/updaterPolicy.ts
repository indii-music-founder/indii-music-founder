import { existsSync } from 'node:fs';
import path from 'node:path';

export const LOCAL_UNSIGNED_BUILD_MARKER = '.indii-local-unsigned-build';

export function isLocalUnsignedBuild(resourcesPath: string): boolean {
    return existsSync(path.join(resourcesPath, LOCAL_UNSIGNED_BUILD_MARKER));
}
