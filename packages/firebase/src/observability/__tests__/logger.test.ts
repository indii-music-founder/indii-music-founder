import { vi, expect, test } from 'vitest';

// No direct import of logger here – we will import after the console spy is installed.

test('logJson emits structured JSON with all fields', async () => {
  const consoleLogSpy = vi.spyOn(global.console, 'log').mockImplementation(() => {});
  const { logJson, Severity } = await import('../logger');

  logJson('hello world', {
    severity: Severity.INFO,
    traceId: 'trace-123',
    payload: { foo: 'bar', count: 42 },
  });

  expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  const logged = consoleLogSpy.mock.calls[0][0];
  const obj = JSON.parse(logged);
  expect(obj.message).toBe('hello world');
  expect(obj.severity).toBe('INFO');
  expect(obj.traceId).toBe('trace-123');
  expect(obj.foo).toBe('bar');
  expect(obj.count).toBe(42);
  expect(new Date(obj.timestamp).toISOString()).toBe(obj.timestamp);
});

test('logJson uses default severity when omitted', async () => {
  const consoleLogSpy = vi.spyOn(global.console, 'log').mockImplementation(() => {});
  const { logJson } = await import('../logger');
  // Ensure no prior calls are counted
  consoleLogSpy.mockClear();
  logJson('default severity');

  expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  const obj = JSON.parse(consoleLogSpy.mock.calls[0][0]);
  expect(obj.severity).toBe('DEFAULT');
  expect(obj.message).toBe('default severity');
});
