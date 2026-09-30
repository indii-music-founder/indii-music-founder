import { vi, test, expect } from 'vitest';
import { reportError } from '../GcpErrorReporter';

const { mockReport } = vi.hoisted(() => ({ mockReport: vi.fn() }));

// Structural regression test for error message formatting.

// Mock the ErrorReporting class
vi.mock('@google-cloud/error-reporting', () => ({
  ErrorReporting: class {
    report = mockReport;
  },
}));

test('reportError includes traceId and severity in custom message', async () => {
  reportError(new Error('boom'), { traceId: 'abc', severity: 'WARNING' });

  expect(mockReport).toHaveBeenCalledTimes(1);
  const [err, , customMessage] = mockReport.mock.calls[0];
  expect(err.message).toBe('boom');
  expect(customMessage).toContain('[traceId:abc]');
  expect(customMessage).toContain('[severity:WARNING]');
});
