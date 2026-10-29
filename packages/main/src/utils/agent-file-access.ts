import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const inside = (root: string, target: string): boolean => {
    const relative = path.relative(root, target);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

/** Workspace containment and a real filesystem grant are separate requirements. */
export function resolveAuthorizedAgentFile(
    targetFile: unknown,
    workingDirectory: string,
    verifyAccess: (canonicalPath: string) => boolean,
): string {
    if (typeof targetFile !== 'string' || !targetFile || targetFile.includes('\0')) {
        throw new Error('Invalid file path');
    }
    const lexicalRoot = path.resolve(workingDirectory);
    const lexicalTarget = path.resolve(lexicalRoot, targetFile);
    if (!inside(lexicalRoot, lexicalTarget)) throw new Error('Invalid file path');
    const canonicalRoot = fs.realpathSync(lexicalRoot);
    const canonicalTarget = fs.realpathSync(lexicalTarget);
    if (!inside(canonicalRoot, canonicalTarget)) throw new Error('Invalid file path');
    if (!verifyAccess(canonicalTarget)) throw new Error('Access denied to target file');
    if (!fs.statSync(canonicalTarget).isFile()) throw new Error('Invalid file path');
    return canonicalTarget;
}

const ReplacementChunksSchema = z.array(z.object({
    targetContent: z.string().min(1),
    replacementContent: z.string(),
})).min(1);

/** Validate the entire edit before the caller performs a write. */
export function replaceUniqueAgentChunks(content: string, rawChunks: unknown): string {
    const chunks = ReplacementChunksSchema.parse(rawChunks);
    let result = content;
    for (const { targetContent, replacementContent } of chunks) {
        const occurrences = result.split(targetContent).length - 1;
        if (occurrences > 1) {
            throw new Error(`Target content occurs multiple times, cannot safely replace: ${targetContent.substring(0, 30)}...`);
        }
        if (occurrences === 0) {
            throw new Error(`Target content not found in file: ${targetContent.substring(0, 30)}...`);
        }
        // Replacement text is literal, not String.replace's $&, $` or $' syntax.
        result = result.replace(targetContent, () => replacementContent);
    }
    return result;
}
