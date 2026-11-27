import { describe, expect, it } from 'vitest';
import { buildAttachmentDataUri } from '@/modules/boardroom/components/boardroomAttachmentDataUri';

describe('buildAttachmentDataUri', () => {
    it('reuses the URI for the same immutable attachment without rereading base64', () => {
        let base64Reads = 0;
        const attachment = {
            mimeType: 'image/png',
            get base64() {
                base64Reads += 1;
                return 'aW1hZ2U=';
            },
        };

        expect(buildAttachmentDataUri(attachment)).toBe('data:image/png;base64,aW1hZ2U=');
        expect(buildAttachmentDataUri(attachment)).toBe('data:image/png;base64,aW1hZ2U=');
        expect(base64Reads).toBe(1);
    });

    it('preserves an existing data URI', () => {
        const attachment = { mimeType: 'image/png', base64: 'data:image/png;base64,aW1hZ2U=' };
        expect(buildAttachmentDataUri(attachment)).toBe(attachment.base64);
    });
});
