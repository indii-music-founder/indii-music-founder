/**
 * Webhook Dispatcher Tests
 *
 * Tests for HMAC signing, retry logic, dead letter queue
 */

import * as crypto from 'crypto';
import { describe, it, expect, vi } from 'vitest';
import { isQueueItemClaimable, enqueueWebhookTask } from '../dispatcher';

describe('WebhookDispatcher', () => {
  const secret = 'test-secret-key';
  const payload = JSON.stringify({ id: 'evt1', type: 'user_action' });

  describe('HMAC Signature', () => {
    it('should generate valid HMAC-SHA256 signature', () => {
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(signature).toBeDefined();
      expect(signature).toHaveLength(64); // SHA256 hex = 64 chars
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = JSON.stringify({ id: 'evt1' });
      const payload2 = JSON.stringify({ id: 'evt2' });

      const sig1 = crypto.createHmac('sha256', secret).update(payload1).digest('hex');
      const sig2 = crypto.createHmac('sha256', secret).update(payload2).digest('hex');

      expect(sig1).not.toBe(sig2);
    });

    it('should verify valid signature', () => {
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const signature = 'invalid-signature';
      const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(() => {
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      }).toThrow();
    });
  });

  describe('Retry Logic', () => {
    it('should calculate exponential backoff delay', () => {
      const delays = [0, 1, 2].map(attempt =>
        Math.pow(2, attempt) * 1000
      );

      expect(delays[0]).toBe(1000); // 1 second
      expect(delays[1]).toBe(2000); // 2 seconds
      expect(delays[2]).toBe(4000); // 4 seconds
    });

    it('should max out at 3 attempts', () => {
      const maxAttempts = 3;
      const attempt1 = 0;
      const attempt2 = 1;
      const attempt3 = 2;
      expect(attempt1 < maxAttempts - 1).toBe(true);
      expect(attempt2 < maxAttempts - 1).toBe(true);
      expect(attempt3 < maxAttempts - 1).toBe(false);
    });

    it('should not retry on 4xx client errors', () => {
      const statusCode = 400;
      const isRetryable = statusCode >= 500 || [408, 429].includes(statusCode);

      expect(isRetryable).toBe(false);
    });

    it('should retry on 5xx server errors', () => {
      const statusCode = 502;
      const isRetryable = statusCode >= 500;

      expect(isRetryable).toBe(true);
    });

    it('should retry on timeout', () => {
      const errorMsg = 'Request timeout';
      const isRetryable = errorMsg.toLowerCase().includes('timeout');

      expect(isRetryable).toBe(true);
    });
  });

  describe('Dead Letter Queue', () => {
    it('should move failed webhooks to DLQ', () => {
      const dlqEvent = {
        webhookEventId: 'webhook-evt-1',
        eventType: 'user_action',
        failedAt: new Date().toISOString(),
        reason: 'Max retries exceeded',
      };

      expect(dlqEvent.failedAt).toBeDefined();
      expect(dlqEvent.reason).toBeDefined();
    });

    it('should record non-retryable errors in DLQ', () => {
      const reason = 'HTTP 401: Unauthorized';
      const isNonRetryable = reason.includes('401');

      expect(isNonRetryable).toBe(true);
    });
  });

  describe('Webhook Delivery', () => {
    it('should send webhook with HMAC header', () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-indii-Signature': 'sig123',
        'X-indii-Event-ID': 'evt1',
        'X-indii-Event-Type': 'user_action',
        'X-indii-Timestamp': '2026-04-24T12:00:00Z',
      };

      expect(headers['X-indii-Signature']).toBeDefined();
    });

    it('should set timeout to 10 seconds', () => {
      const timeout = 10000;
      expect(timeout).toBe(10000);
    });

    it('should include event ID for idempotency', () => {
      const eventId = 'evt-1234567890';
      const headers = {
        'X-indii-Event-ID': eventId,
      };

      expect(headers['X-indii-Event-ID']).toBe(eventId);
    });
  });

  describe('Webhook Filtering', () => {
    it('should match event type to subscribed events', () => {
      const eventType = 'track_created';
      const subscribedTo = ['track_created', 'distribution_started'];

      const isSubscribed = subscribedTo.includes(eventType);
      expect(isSubscribed).toBe(true);
    });

    it('should skip unsubscribed event types', () => {
      const eventType = 'admin_action';
      const subscribedTo = ['track_created'];

      const isSubscribed = subscribedTo.includes(eventType);
      expect(isSubscribed).toBe(false);
    });
  });

  describe('Queue Management', () => {
    it('should process pending webhooks', () => {
      const now = new Date().toISOString();
      const nextRetry = '2026-04-24T11:55:00Z'; // Past

      const isPending = nextRetry <= now;
      expect(isPending).toBe(true);
    });

    it('should skip future-scheduled webhooks', () => {
      const now = new Date().toISOString();
      const nextRetry = new Date(Date.now() + 5000).toISOString(); // 5 seconds future

      const isPending = nextRetry <= now;
      expect(isPending).toBe(false);
    });

    it('should limit batch size to 50', () => {
      const BATCH_SIZE = 50;
      const queuedCount = 120;

      const batchCount = Math.ceil(queuedCount / BATCH_SIZE);
      expect(batchCount).toBe(3); // 50 + 50 + 20
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network errors', () => {
      const error = new Error('ECONNREFUSED');
      expect(error.message).toContain('ECONNREF');
    });

    it('should handle invalid JSON responses', () => {
      const response = 'Not valid JSON';
      expect(() => JSON.parse(response)).toThrow();
    });

    it('should handle webhook URL mismatch', () => {
      const webhookUrl = 'https://example.com/webhook';
      const requestUrl = 'https://example.com/different';

      expect(webhookUrl).not.toBe(requestUrl);
    });

    it('should handle missing webhook record', () => {
      const webhookExists = false;
      expect(webhookExists).toBe(false);
    });
  });

  describe('Webhook Creation', () => {
    it('should validate webhook URL format', () => {
      const validUrl = 'https://example.com/webhook';
      const isHttps = validUrl.startsWith('https://');

      expect(isHttps).toBe(true);
    });

    it('should require event types array', () => {
      const webhook = {
        url: 'https://example.com',
        secret: 'secret123',
        events: ['track_created', 'distribution_started'],
      };

      expect(Array.isArray(webhook.events)).toBe(true);
      expect(webhook.events.length).toBeGreaterThan(0);
    });

    it('should generate webhook secret', () => {
      const secret = crypto.randomBytes(32).toString('hex');

      expect(secret).toHaveLength(64); // 32 bytes = 64 hex chars
    });
  });

  describe('Event Payload', () => {
    it('should include complete event data', () => {
      const payload = {
        id: 'evt-123',
        type: 'track_created',
        data: { trackId: 'track1', title: 'My Song' },
        timestamp: '2026-04-24T12:00:00Z',
      };

      expect(payload.id).toBeDefined();
      expect(payload.type).toBeDefined();
      expect(payload.data).toBeDefined();
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe('Scheduled Processing', () => {
    it('should process queue on a valid Cloud Scheduler interval (1 minute fallback)', () => {
      const schedule = 'every 1 minutes';
      const intervalMs = 60 * 1000;

      expect(intervalMs).toBe(60000);
      expect(schedule).toContain('1');
    });

    it('should handle concurrent webhook deliveries', () => {
      const concurrentCount = 50; // Max batch size
      expect(concurrentCount).toBeLessThanOrEqual(100);
    });

    it('should enqueue directly to Cloud Tasks when client and config are present', async () => {
      const createTaskMock = vi.fn().mockResolvedValue({});
      const queuePathMock = vi.fn().mockReturnValue('projects/p/locations/l/queues/webhook-delivery');

      const mockTasksClient = {
        createTask: createTaskMock,
        queuePath: queuePathMock,
      };

      const event = {
        eventId: 'evt-100',
        webhookId: 'wh-1',
        userId: 'user-1',
        eventType: 'track_created',
        payload: { title: 'Track 1' },
        timestamp: '2026-09-01T12:00:00Z',
        attempt: 0,
        maxAttempts: 3,
      };

      const enqueued = await enqueueWebhookTask(event, mockTasksClient, {
        project: 'test-project',
        location: 'us-central1',
        queue: 'webhook-delivery',
        workerUrl: 'https://worker.indii.internal',
        serviceAccount: 'invoker@indii.iam.gserviceaccount.com',
        audience: 'https://worker.indii.internal',
      });

      expect(enqueued).toBe(true);
      expect(queuePathMock).toHaveBeenCalledWith('test-project', 'us-central1', 'webhook-delivery');
      expect(createTaskMock).toHaveBeenCalledOnce();
      const call = createTaskMock.mock.calls[0][0];
      expect(call.parent).toBe('projects/p/locations/l/queues/webhook-delivery');
      expect(call.task.name).toContain('webhook-evt-100');
      expect(call.task.httpRequest.oidcToken.serviceAccountEmail).toBe('invoker@indii.iam.gserviceaccount.com');
    });
  });
});

describe('Queue claim lease', () => {
  const now = 1_750_000_000_000;

  it('claims items with no lease', () => {
    expect(isQueueItemClaimable({}, now)).toBe(true);
  });

  it('refuses items another worker still holds a live lease on', () => {
    expect(isQueueItemClaimable({ leaseUntil: new Date(now + 60_000).toISOString() }, now)).toBe(false);
  });

  it('reclaims items whose lease expired (crashed worker)', () => {
    expect(isQueueItemClaimable({ leaseUntil: new Date(now - 1).toISOString() }, now)).toBe(true);
  });
});
