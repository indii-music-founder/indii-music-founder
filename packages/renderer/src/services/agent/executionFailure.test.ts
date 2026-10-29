import { describe, expect, it } from 'vitest';
import { delegatedAgentResult, delegatedAgentText, delegatedTransportResponse, unauthorizedToolFailure } from './executionFailure';

// Pure outcome contracts: no model, provider, authenticated user or service mocks.
describe('terminal tool authorization and delegation outcomes', () => {
    it('marks a denied tool as non-retryable and retains the exact capability boundary', () => {
        expect(unauthorizedToolFailure('devops', 'report_bug')).toEqual({
            code: 'TOOL_NOT_AUTHORIZED', retryable: false, agentId: 'devops',
            toolName: 'report_bug', recovery: 'choose_authorized_agent',
        });
    });
    it('does not turn a child permission denial into delegation success', () => {
        const failure = unauthorizedToolFailure('devops', 'report_bug');
        const response = { text: 'Choose an authorized reporter.', error: 'Permission denied', failure };
        const result = delegatedAgentResult('devops', response);
        expect(result.success).toBe(false);
        expect(result.failure).toBe(failure);
        expect(result.error).toBe('Permission denied');
        expect(result.data).toBe(response);
    });
    it('preserves a distinct child failure without assigning authorization classification', () => {
        const result = delegatedAgentResult('devops', { text: 'Child execution failed.', error: 'CHILD_EXECUTION_FAILED' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('CHILD_EXECUTION_FAILED');
        expect(result.failure).toMatchObject({ code: 'AGENT_EXECUTION_FAILED', retryable: false, recovery: 'review_failure' });
    });
    it('requires no error string to preserve an explicit terminal failure', () => {
        const failure = unauthorizedToolFailure('devops', 'report_bug');
        expect(delegatedAgentResult('devops', { text: 'Blocked.', failure })).toMatchObject({ success: false, failure });
    });
    it('keeps terminal failure metadata across transport without copying internal data', () => {
        const failure = unauthorizedToolFailure('devops', 'report_bug');
        const result = delegatedTransportResponse('devops', { text: 'Blocked.', error: 'Denied', failure, data: { internal: 'not transmitted' } });
        expect(result).toEqual({ agentId: 'devops', text: 'Blocked.', error: 'Denied', failure });
        expect(result).not.toHaveProperty('data');
    });
    it('does not let a string-only graph adapter turn a denial into completed output', () => {
        const failure = unauthorizedToolFailure('devops', 'report_bug');
        expect(() => delegatedAgentText({ text: 'Blocked.', failure }))
            .toThrow('Blocked.');
        expect(delegatedAgentText({ text: 'Diagnostic output.' })).toBe('Diagnostic output.');
    });
    it('preserves a completed child response and its data without inventing an issue receipt', () => {
        const response = { text: 'Diagnostic response.' };
        const result = delegatedAgentResult('devops', response);
        expect(result.success).toBe(true);
        expect(result.data).toBe(response);
        expect(result.documentUrl).toBeUndefined();
    });
});
