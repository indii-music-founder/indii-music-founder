import type { CapabilitySnapshot, CapabilityStatus } from '@shared/schemas/capabilitySnapshot';
import { beforeEach, describe, expect, it } from 'vitest';

import {
    buildCapabilitySummary,
    getCapabilityHealth,
    isCapabilityQuestion,
    recordCapabilityHealth,
    resetCapabilityHealthForTests,
} from './capabilityTruth';

const NOW = Date.parse('2026-07-30T12:00:00.000Z');

function snapshot(
    statuses: Partial<Record<keyof CapabilitySnapshot['capabilities'], CapabilityStatus>> = {},
): CapabilitySnapshot {
    const expiresAt = NOW + 60_000;
    const entry = (status: CapabilityStatus = 'unverified') => ({
        status,
        observedAt: NOW,
        expiresAt,
    });
    return {
        schemaVersion: 'capability-snapshot.v1',
        observedAt: NOW,
        expiresAt,
        capabilities: {
            specialist_routing: entry(statuses.specialist_routing),
            image_generation: entry(statuses.image_generation),
            video_generation: entry(statuses.video_generation),
            durable_workspace: entry(statuses.durable_workspace),
            durable_memory: entry(statuses.durable_memory),
            calendar_connection: entry(statuses.calendar_connection),
            calendar_actions: {
                ...entry(statuses.calendar_actions),
                approvalRequired: true,
            },
            social_connection: entry(statuses.social_connection),
            social_publishing: {
                ...entry(statuses.social_publishing),
                approvalRequired: true,
            },
        },
    };
}

describe('Boardroom capability truthfulness', () => {
    beforeEach(resetCapabilityHealthForTests);

    it('recognizes capability questions without relying on model interpretation', () => {
        expect(isCapabilityQuestion('What can and can’t you do based on the APIs you have?')).toBe(true);
        expect(isCapabilityQuestion('Please make a dog image')).toBe(false);
    });

    it('requires both registered authorization and server evidence before claiming a tool', () => {
        const noServerEvidence = buildCapabilitySummary({
            authorizedTools: ['generate_image', 'save_memory', 'recall_memories'],
            registeredSpecialistIds: [],
            snapshot: snapshot(),
        });
        const noRegisteredTool = buildCapabilitySummary({
            authorizedTools: [],
            registeredSpecialistIds: [],
            snapshot: snapshot({
                image_generation: 'available',
                durable_memory: 'available',
            }),
        });

        expect(noServerEvidence).not.toContain('Available now');
        expect(noServerEvidence).toContain('Not verified right now');
        expect(noRegisteredTool).not.toContain('create images');
        expect(noRegisteredTool).not.toContain('save and recall');
    });

    it('claims only capabilities that are both server-attested and locally usable', () => {
        const output = buildCapabilitySummary({
            authorizedTools: ['generate_image', 'save_memory', 'recall_memories', 'unregistered_tool'],
            registeredSpecialistIds: [],
            snapshot: snapshot({
                image_generation: 'available',
                durable_memory: 'available',
            }),
        });

        expect(output).toContain('Available now');
        expect(output).toContain('create images');
        expect(output).toContain('save and recall approved workspace context');
        expect(output).not.toContain('unregistered_tool');
        expect(output).not.toContain('generate_image');
        expect(output).not.toContain('save_memory');
    });

    it('does not overstate a grouped capability when only part of its tool set is registered', () => {
        const output = buildCapabilitySummary({
            authorizedTools: ['create_project', 'save_memory'],
            registeredSpecialistIds: [],
            snapshot: snapshot({
                durable_workspace: 'available',
                durable_memory: 'available',
            }),
        });

        expect(output).not.toContain('organize projects and find workspace material');
        expect(output).not.toContain('save and recall approved workspace context');
        expect(output).not.toContain('Available now');
    });

    it('does not let a registry-only finance specialist become available', () => {
        const output = buildCapabilitySummary({
            authorizedTools: ['consult_specialist'],
            registeredSpecialistIds: ['finance'],
            snapshot: snapshot({ specialist_routing: 'unverified' }),
        });

        expect(output).not.toContain('finance analysis');
        expect(output).not.toContain('Through qualified specialists');
    });

    it('lists only safe registered specialist labels after server routing attestation', () => {
        const output = buildCapabilitySummary({
            authorizedTools: ['consult_specialist'],
            registeredSpecialistIds: ['finance', 'planned-banking-agent'],
            snapshot: snapshot({ specialist_routing: 'available' }),
        });

        expect(output).toContain('finance analysis');
        expect(output).not.toContain('planned-banking-agent');
        expect(output).not.toContain('consult_specialist');
    });

    it('allows observed local failures to downgrade but never promote server evidence', () => {
        recordCapabilityHealth('image_generation', {
            status: 'degraded',
            retryAfterSeconds: 30,
        });

        const output = buildCapabilitySummary({
            authorizedTools: ['generate_image'],
            registeredSpecialistIds: [],
            snapshot: snapshot({ image_generation: 'available' }),
            health: getCapabilityHealth(),
        });

        expect(output).toContain('Temporarily unavailable');
        expect(output).toContain('create images');
        expect(output).toContain('Retry in about 30 seconds');
        expect(output).not.toContain('Available now: create images');
    });

    it('labels connected external actions as approval-required without claiming completion', () => {
        const connected = buildCapabilitySummary({
            authorizedTools: ['schedule_post_execution'],
            registeredSpecialistIds: [],
            snapshot: snapshot({ social_publishing: 'available' }),
        });
        const disconnected = buildCapabilitySummary({
            authorizedTools: ['schedule_post_execution'],
            registeredSpecialistIds: [],
            snapshot: snapshot({ social_publishing: 'blocked' }),
        });

        expect(connected).toContain('Requires your approval');
        expect(connected).toContain('verified social connection');
        expect(connected).not.toMatch(/published|completed|active post/i);
        expect(disconnected).not.toContain('verified social connection');
    });

    it('does not present banking, rights, or delivery integrations as active', () => {
        const output = buildCapabilitySummary({
            authorizedTools: [],
            registeredSpecialistIds: [],
            snapshot: snapshot(),
        });

        expect(output).toContain('Not active in this session');
        expect(output).toContain('direct banking transactions');
        expect(output).toContain('rights-society registration');
        expect(output).toContain('DSP delivery');
        expect(output).not.toMatch(/recent|outage|failed last week/i);
    });

    it('exposes no internal identifiers in public text', () => {
        const output = buildCapabilitySummary({
            authorizedTools: ['generate_image', 'consult_specialist'],
            registeredSpecialistIds: ['finance'],
            snapshot: snapshot({
                image_generation: 'available',
                specialist_routing: 'available',
            }),
        });

        expect(output).not.toMatch(/generate_image|consult_specialist|endpoint|provider|token|MCP|API gateway|No-Mock/i);
    });
});
