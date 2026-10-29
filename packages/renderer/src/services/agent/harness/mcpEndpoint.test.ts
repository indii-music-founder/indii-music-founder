import { describe, expect, it } from 'vitest';
import { assertMcpTransportDestination, resolveMcpEndpoint } from './mcpEndpoint';

// Pure URL policy only; no tokens, account state, transports or service mocks.
describe('MCP endpoint and transport destination policy', () => {
    it('uses the active project production gateway instead of localhost', () => {
        expect(resolveMcpEndpoint(undefined, 'project-alpha', false))
            .toBe('https://us-central1-project-alpha.cloudfunctions.net/mcpEndpoint');
    });
    it('uses the active project emulator only in development', () => {
        expect(resolveMcpEndpoint('', 'project-alpha', true))
            .toBe('http://127.0.0.1:5001/project-alpha/us-central1/mcpEndpoint');
    });
    it('accepts an explicit HTTPS deployment without requiring a project fallback', () => {
        expect(resolveMcpEndpoint('https://gateway.example.com/mcp/', '', false))
            .toBe('https://gateway.example.com/mcp');
        expect(resolveMcpEndpoint('https://gateway.example.com/', '', false)).toBe('https://gateway.example.com');
    });
    it('fails visibly for absent/unsafe projects instead of selecting another project', () => {
        for (const id of [undefined, '', 'a/b', 'bad?project', 'UPPERCASE']) {
            expect(() => resolveMcpEndpoint(undefined, id, false)).toThrow();
        }
    });
    it('rejects credentials, fragments, query strings and insecure production endpoints', () => {
        for (const endpoint of ['http://127.0.0.1:5001/mcp', 'http://example.com', 'https://user:password@example.com', 'https://example.com/?key=value', 'https://example.com/#fragment', 'file:///private/data']) {
            expect(() => resolveMcpEndpoint(endpoint, '', false)).toThrow();
        }
    });
    it('limits development HTTP exceptions to loopback', () => {
        expect(resolveMcpEndpoint('http://localhost:5001/mcp', '', true)).toBe('http://localhost:5001/mcp');
        expect(() => resolveMcpEndpoint('http://example.com/mcp', '', true)).toThrow();
    });
    it('allows only the configured SSE and message paths, including session queries', () => {
        const base = 'https://gateway.example.com/mcp';
        expect(() => assertMcpTransportDestination(`${base}/sse`, base)).not.toThrow();
        expect(() => assertMcpTransportDestination(new URL(`${base}/message?sessionId=id`), base)).not.toThrow();
    });
    it('rejects advertised foreign origins, sibling paths and disguised destinations', () => {
        const base = 'https://gateway.example.com/mcp';
        for (const target of ['https://other.example.com/mcp/message', 'https://gateway.example.com/message', 'https://gateway.example.com/mcp-extra/message', 'https://gateway.example.com/mcp/../message', 'https://user:password@gateway.example.com/mcp/message', 'https://gateway.example.com/mcp/message#fragment']) {
            expect(() => assertMcpTransportDestination(target, base)).toThrow();
        }
    });
});
