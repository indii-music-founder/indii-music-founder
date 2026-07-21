/**
 * redactScreenshotPng — CE-5, ISSUE-1114: strips PNG ancillary metadata chunks before a
 * screenshot leaves the machine (returned over IPC to the renderer, and from there
 * potentially to the model or a Firestore session doc).
 *
 * Scope, deliberately: this does NOT redact on-screen UI content — the model needs to see
 * the real screen to act on it (computer_drive), so pixel redaction of arbitrary "sensitive"
 * regions is an unspecified, unbuildable requirement without a concrete definition of what's
 * sensitive. What IS concrete and buildable: PNG files can carry ancillary metadata chunks
 * (tEXt/zTXt/iTXt/eXIf/tIME) that leak OS username, software version strings, or capture
 * timestamps — encoders sometimes embed these even for programmatic captures. This function
 * strips exactly that class of chunk and leaves pixel data (IDAT), palette, and
 * color/gamma/physical-dimension chunks untouched.
 *
 * PNG structure: 8-byte signature, then a sequence of [4-byte length][4-byte type][data]
 * [4-byte CRC] chunks. This function walks the chunk list and omits any chunk whose type is
 * in the blocklist — no CRC recomputation is needed since surviving chunks are copied as-is.
 */

const PNG_SIGNATURE_LENGTH = 8;
const CHUNK_LENGTH_FIELD = 4;
const CHUNK_TYPE_FIELD = 4;
const CHUNK_CRC_FIELD = 4;

const METADATA_CHUNK_TYPES = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

export function redactScreenshotPng(png: Buffer): Buffer {
    if (png.length < PNG_SIGNATURE_LENGTH) return png;

    const parts: Buffer[] = [png.subarray(0, PNG_SIGNATURE_LENGTH)];
    let offset = PNG_SIGNATURE_LENGTH;

    while (offset + CHUNK_LENGTH_FIELD + CHUNK_TYPE_FIELD <= png.length) {
        const dataLength = png.readUInt32BE(offset);
        const chunkType = png.toString('ascii', offset + CHUNK_LENGTH_FIELD, offset + CHUNK_LENGTH_FIELD + CHUNK_TYPE_FIELD);
        const chunkTotalLength = CHUNK_LENGTH_FIELD + CHUNK_TYPE_FIELD + dataLength + CHUNK_CRC_FIELD;

        if (offset + chunkTotalLength > png.length) {
            // Malformed/truncated chunk — stop parsing and keep the remainder verbatim
            // rather than risk corrupting a well-formed file we failed to fully understand.
            parts.push(png.subarray(offset));
            offset = png.length;
            break;
        }

        if (!METADATA_CHUNK_TYPES.has(chunkType)) {
            parts.push(png.subarray(offset, offset + chunkTotalLength));
        }

        offset += chunkTotalLength;
        if (chunkType === 'IEND') break;
    }

    return Buffer.concat(parts);
}
