import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock('@/services/email', () => ({ EmailService: { sendEmail } }));

import { EmailTools } from '@/services/agent/tools/EmailTools';

const sendArgs = { accountId: 'gmail-1', to: 'fan@example.com', subject: 'Hi', body: 'Hello' };
const replyArgs = { ...sendArgs, threadId: 't1', inReplyTo: 'm1' };

describe('EmailTools send honesty', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        ['send_email', sendArgs],
        ['reply_to_email', replyArgs],
    ] as const)('%s reports success only when the provider confirms the send', async (name, args) => {
        sendEmail.mockResolvedValueOnce({ success: true, messageId: 'm-9' });
        const result = await (EmailTools[name] as (a: unknown) => Promise<any>)(args);
        expect(result.success).toBe(true);
    });

    it.each([
        ['send_email', sendArgs],
        ['reply_to_email', replyArgs],
    ] as const)('%s never claims a send the provider reported as failed (%s)', async (name, args) => {
        sendEmail.mockResolvedValueOnce({ success: false, error: 'Gmail send failed: 403' });
        const result = await (EmailTools[name] as (a: unknown) => Promise<any>)(args);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Gmail send failed: 403');
        expect(result.message).not.toMatch(/sent successfully/i);
    });
});
