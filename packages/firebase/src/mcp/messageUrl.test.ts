import { describe, expect, it } from 'vitest';
import { mcpMessageUrl } from './messageUrl.js';

// URL construction only; no transport, credentials or simulated sessions.
describe('MCP message callback URL', () => {
    it('preserves the deployed Cloud Function prefix over HTTPS', () => {
        expect(mcpMessageUrl('us-central1-project-alpha.cloudfunctions.net', false))
            .toBe('https://us-central1-project-alpha.cloudfunctions.net/mcpEndpoint/message');
    });
    it('uses the root message path for a direct service host', () => {
        expect(mcpMessageUrl('gateway.run.app', false)).toBe('https://gateway.run.app/message');
        expect(mcpMessageUrl('gateway.run.app:443', false)).toBe('https://gateway.run.app/message');
    });
    it('rebuilds the emulator project and region prefix over HTTP', () => {
        expect(mcpMessageUrl('127.0.0.1:5001', true, 'project-alpha'))
            .toBe('http://127.0.0.1:5001/project-alpha/us-central1/mcpEndpoint/message');
    });
    it('rejects invalid hosts and non-loopback or unconfigured emulator callbacks', () => {
        for (const host of ['example.com/path', 'user:pass@example.com', 'example.com?value=x', 'example.com#fragment', '']) {
            expect(() => mcpMessageUrl(host, false)).toThrow();
        }
        expect(() => mcpMessageUrl('example.com', true, 'project-alpha')).toThrow();
        expect(() => mcpMessageUrl('localhost:5001', true)).toThrow();
        expect(() => mcpMessageUrl('localhost:5001', true, 'bad/project')).toThrow();
    });
});
