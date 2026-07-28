import { beforeEach, describe, expect, it } from 'vitest';
import {
    buildCapabilitySummary,
    getCapabilityHealth,
    isCapabilityQuestion,
    recordCapabilityHealth,
    resetCapabilityHealthForTests,
} from './capabilityTruth';

describe('Boardroom capability truthfulness', () => {
    beforeEach(resetCapabilityHealthForTests);

    it('recognizes capability questions without relying on model interpretation', () => {
        expect(isCapabilityQuestion('What can and can’t you do based on the APIs you have?')).toBe(true);
        expect(isCapabilityQuestion('Please make a dog image')).toBe(false);
    });

    it('claims only registered, authorized capabilities and hides internal identifiers', () => {
        const output = buildCapabilitySummary({
            authorizedTools: ['generate_image', 'save_memory', 'recall_memories', 'unregistered_tool'],
            registeredSpecialistIds: ['finance', 'planned-banking-agent'],
        });

        expect(output).toContain('create images');
        expect(output).toContain('finance analysis');
        expect(output).not.toContain('planned-banking-agent');
        expect(output).not.toContain('generate_image');
        expect(output).not.toContain('save_memory');
        expect(output).not.toContain('MCP');
        expect(output).not.toContain('API gateway');
        expect(output).not.toContain('No-Mock');
    });

    it('shows a failing image path as temporarily unavailable', () => {
        recordCapabilityHealth('image_generation', {
            status: 'degraded',
            retryAfterSeconds: 30,
        });

        const output = buildCapabilitySummary({
            authorizedTools: ['generate_image'],
            registeredSpecialistIds: [],
            health: getCapabilityHealth(),
        });

        expect(output).toContain('Temporarily unavailable');
        expect(output).toContain('create images');
        expect(output).toContain('Retry in about 30 seconds');
        expect(output).not.toContain('Available now: create images');
    });

    it('does not present planned banking, rights, or DSP integrations as active', () => {
        const output = buildCapabilitySummary({
            authorizedTools: [],
            registeredSpecialistIds: [],
        });

        expect(output).toContain('Not active in this session');
        expect(output).toContain('direct banking transactions');
        expect(output).toContain('rights-society registration');
        expect(output).toContain('DSP delivery');
        expect(output).not.toMatch(/recent|outage|failed last week/i);
    });

    it('labels approval-required capabilities without leaking tool names', () => {
        const output = buildCapabilitySummary({
            authorizedTools: ['computer_open_app'],
            registeredSpecialistIds: [],
        });

        expect(output).toContain('Requires your approval');
        expect(output).not.toContain('computer_open_app');
    });
});
