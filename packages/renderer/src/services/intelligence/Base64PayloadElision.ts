/** Elide image bytes from prompt text without regex recursion over large exports. */
export function elideBase64Payloads(text: string): string {
    if (!text || !text.includes(';base64,')) return text;
    const prefix = /data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,/g;
    const pieces: string[] = [];
    let copiedThrough = 0;
    let match: RegExpExecArray | null;
    while ((match = prefix.exec(text)) !== null) {
        const payloadStart = prefix.lastIndex;
        let end = payloadStart;
        while (end < text.length) {
            const code = text.charCodeAt(end);
            if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
                (code >= 48 && code <= 57) || code === 43 || code === 47 || code === 61)) break;
            end++;
        }
        const payloadLength = end - payloadStart;
        if (payloadLength >= 1024) {
            pieces.push(text.slice(copiedThrough, match.index));
            pieces.push(`data:${match[1]};base64,[elided ${Math.max(1, Math.round(payloadLength * 3 / 4 / 1024))}KB — delivered to the model as inlineData when needed]`);
            copiedThrough = end;
        }
        prefix.lastIndex = end;
    }
    if (copiedThrough === 0) return text;
    pieces.push(text.slice(copiedThrough));
    return pieces.join('');
}
