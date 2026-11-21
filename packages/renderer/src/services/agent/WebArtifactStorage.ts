import { getBytes, list, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '@/services/firebase';

const maxArtifactBytes = 256 * 1024;
const artifactFilename = /^(?!\.)[^/\\]+\.(?:md|json)$/u;

function isArtifactFilename(filename: unknown): filename is string {
    return typeof filename === 'string' && filename.length <= 180 && artifactFilename.test(filename)
        && !Array.from(filename).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function workspace(owner?: string) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || user.uid !== owner) {
        throw new Error('Sign in to access your Workbench documents.');
    }
    return ref(storage, `users/${user.uid}/artifacts`);
}

function documentRef(owner: string | undefined, filename: string) {
    if (!isArtifactFilename(filename)) throw new Error('Use a plain .md or .json filename.');
    return ref(workspace(owner), filename);
}

export const webArtifactStorage = {
    async write(owner: string | undefined, filename: string, content: string) {
        const target = documentRef(owner, filename);
        if (typeof content !== 'string') throw new Error('Invalid artifact content.');
        const bytes = new TextEncoder().encode(content);
        if (bytes.byteLength > maxArtifactBytes) throw new Error('Workbench documents are limited to 256 KB.');
        await uploadBytes(target, bytes, {
            contentType: filename.endsWith('.md') ? 'text/markdown' : 'application/json',
        });
    },

    async read(owner: string | undefined, filename: string) {
        const bytes = await getBytes(documentRef(owner, filename), maxArtifactBytes + 1);
        if (bytes.byteLength > maxArtifactBytes) throw new Error('This Workbench document exceeds 256 KB.');
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },

    async list(owner: string | undefined) {
        const artifacts: { filename: string }[] = [];
        let pageToken: string | undefined;
        do {
            const page = await list(workspace(owner), { maxResults: 100, pageToken });
            artifacts.push(...page.items.filter(item => isArtifactFilename(item.name)).map(item => ({ filename: item.name })));
            pageToken = page.nextPageToken;
        } while (pageToken);
        return artifacts;
    },
};
