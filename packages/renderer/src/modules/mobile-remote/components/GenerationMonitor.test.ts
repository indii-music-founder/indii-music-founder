import { describe, it, expect } from 'vitest';
import { buildGeneratedImagesGallery } from './GenerationMonitor';
import type { RemoteCommand, RemoteResponse } from '@/services/agent/RemoteRelayService';
import { Timestamp } from 'firebase/firestore';

function makeCommand(over: Partial<RemoteCommand>): RemoteCommand {
    return {
        id: 'cmd-1',
        text: '[GENERATE_IMAGE] a neon skyline',
        timestamp: Timestamp.fromMillis(1000),
        status: 'completed',
        createdAt: Timestamp.fromMillis(1000),
        ...over,
    };
}

function makeResponse(over: Partial<RemoteResponse>): RemoteResponse {
    return {
        id: 'resp-1',
        commandId: 'cmd-1',
        text: 'done',
        timestamp: Timestamp.fromMillis(2000),
        isStreaming: false,
        isFinal: true,
        ...over,
    };
}

describe('buildGeneratedImagesGallery (ISSUE-990)', () => {
    it('includes an image whose command is a confirmed generate_image request', () => {
        const commands = [makeCommand({ id: 'cmd-1', metadata: { type: 'generate_image' } })];
        const responses = [makeResponse({ commandId: 'cmd-1', imageUrls: ['https://cdn.example/a.png'] })];

        const gallery = buildGeneratedImagesGallery(commands, responses, []);

        expect(gallery).toEqual([
            { url: 'https://cdn.example/a.png', prompt: 'a neon skyline', timestamp: 2000 },
        ]);
    });

    it('quarantines (excludes) a response whose command is not a generate_image request', () => {
        // e.g. a [SHOW] retrieval or a boardroom/chat response reusing the same imageUrls channel
        const commands = [makeCommand({ id: 'cmd-1', text: '[SHOW]', metadata: { type: 'show_me' } })];
        const responses = [makeResponse({ commandId: 'cmd-1', imageUrls: ['https://cdn.example/leaked.png'] })];

        const gallery = buildGeneratedImagesGallery(commands, responses, []);

        expect(gallery).toEqual([]);
    });

    it('quarantines an orphan response with no matching command at all, instead of relabeling it', () => {
        const responses = [makeResponse({ commandId: 'unknown-cmd', imageUrls: ['https://cdn.example/orphan.png'] })];

        const gallery = buildGeneratedImagesGallery([], responses, []);

        expect(gallery).toEqual([]);
    });

    it('quarantines a command with no metadata at all (generic chat command)', () => {
        const commands = [makeCommand({ id: 'cmd-1', metadata: undefined })];
        const responses = [makeResponse({ commandId: 'cmd-1', imageUrls: ['https://cdn.example/chat.png'] })];

        const gallery = buildGeneratedImagesGallery(commands, responses, []);

        expect(gallery).toEqual([]);
    });

    it('always includes locally-tracked generations from this session', () => {
        const gallery = buildGeneratedImagesGallery([], [], [
            { url: 'https://cdn.example/local.png', prompt: 'a local prompt', timestamp: 5000 },
        ]);

        expect(gallery).toEqual([
            { url: 'https://cdn.example/local.png', prompt: 'a local prompt', timestamp: 5000 },
        ]);
    });

    it('dedupes by URL, preferring the confirmed relay entry over a duplicate local one', () => {
        const commands = [makeCommand({ id: 'cmd-1', metadata: { type: 'generate_image' } })];
        const responses = [makeResponse({ commandId: 'cmd-1', imageUrls: ['https://cdn.example/dup.png'] })];
        const local = [{ url: 'https://cdn.example/dup.png', prompt: 'local caption', timestamp: 9999 }];

        const gallery = buildGeneratedImagesGallery(commands, responses, local);

        expect(gallery).toHaveLength(1);
        expect(gallery[0]!.prompt).toBe('a neon skyline');
    });

    it('sorts newest-first and caps at 24 items', () => {
        const commands = Array.from({ length: 30 }, (_, i) => makeCommand({ id: `cmd-${i}`, metadata: { type: 'generate_image' } }));
        const responses = Array.from({ length: 30 }, (_, i) => makeResponse({
            commandId: `cmd-${i}`,
            imageUrls: [`https://cdn.example/${i}.png`],
            timestamp: Timestamp.fromMillis(i),
        }));

        const gallery = buildGeneratedImagesGallery(commands, responses, []);

        expect(gallery).toHaveLength(24);
        expect(gallery[0]!.url).toBe('https://cdn.example/29.png');
        expect(gallery[23]!.url).toBe('https://cdn.example/6.png');
    });
});
