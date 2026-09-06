import type { CapabilitySnapshot, CapabilityStatus } from '@shared/schemas/capabilitySnapshot';
import { beforeEach, describe, expect, it } from 'vitest';

import {
    buildCapabilitySummary,
    buildDepartmentAuditReport,
    detectUngroundedEngineeringHallucination,
    getCapabilityHealth,
    isCapabilityQuestion,
    isDepartmentAuditOrReadinessQuestion,
    recordCapabilityHealth,
    resetCapabilityHealthForTests,
    sanitizeAgentCapabilityOutput,
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

    it.each([
        'What can you do?',
        'What can and can’t you do based on the APIs you have?',
        'What are indii’s capabilities?',
        'Which tools can you use?',
        'Do you have access to any tools?',
        'Are your tools available right now?',
        'Is image generation available right now?',
        'Can you generate videos right now?',
        'can you make can you make me an image or you have that ability yet',
        'Could you create me a picture, or are visuals available yet?',
        'Are you ready to create an image?',
        'Did the other agents the other 23 get their requested tools?',
        'Did the other agents get their requested tools?',
        'Are the other departments tools deployed right now?',
    ])('recognizes explicit capability or readiness intent: %s', task => {
        expect(isCapabilityQuestion(task)).toBe(true);
    });

    it.each([
        "well I'm just trying to get some Chit Chat going right now and it really we're just testing",
        'Hello, we are only testing the Boardroom.',
        'Our API discussion is about release metadata.',
        'The API capabilities changed in the vendor documentation.',
        'The prior agent mentioned its tools and capabilities.',
        'Please make a dog image.',
        'Can you help me design a video campaign?',
    ])('keeps chitchat, generic API talk, and ordinary tasks on normal execution: %s', task => {
        expect(isCapabilityQuestion(task)).toBe(false);
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

    describe('Department tool audit and zero-hallucination guardrails', () => {
        it.each([
            'Did the other agents the other 23 get their requested tools?',
            'Did the other agents get their requested tools?',
            'Have the other 23 agents received their requested tools?',
            'Are the other departments tools deployed right now?',
            'Are all 23 departments tools ready?',
            'What tools do the other 23 agents have?',
            'Run a board-wide audit of all 23 department heads',
            'Are any of the 23 agents in a holding pattern?',
            'Are we in a holding pattern waiting for the engineering sprint?',
            'status report on the 23 department heads',
        ])('recognizes department tool audit and readiness questions: %s', query => {
            expect(isDepartmentAuditOrReadinessQuestion(query)).toBe(true);
            expect(isCapabilityQuestion(query)).toBe(true);
        });

        it('buildDepartmentAuditReport explicitly affirms all 23 departments and rejects holding pattern/engineering sprint myths', () => {
            const report = buildDepartmentAuditReport();
            expect(report).toContain('Yes. All 23 department heads have their requested and specialized tools fully implemented');
            expect(report).toContain('None are in a "holding pattern"');
            expect(report).toContain('no pending "engineering sprint"');
            // Check all 23 departments are represented
            const expectedDepartments = [
                'Finance', 'Legal', 'Distribution', 'Marketing', 'Brand', 'Music', 'Video',
                'Social', 'Publicist', 'Publishing', 'Licensing', 'Road', 'Hospitality',
                'Event Planning', 'Merchandise', 'Creative', 'Producer', 'Director',
                'Screenwriter', 'DevOps', 'Security', 'Curriculum', 'Keeper'
            ];
            for (const dept of expectedDepartments) {
                expect(report).toContain(dept);
            }
        });

        it('buildCapabilitySummary delegates to buildDepartmentAuditReport when given a department audit query', () => {
            const output = buildCapabilitySummary({
                authorizedTools: ['generate_image'],
                registeredSpecialistIds: ['finance'],
                snapshot: snapshot(),
                query: 'Did the other agents the other 23 get their requested tools?',
            });
            expect(output).toContain('Yes. All 23 department heads have their requested and specialized tools fully implemented');
            expect(output).toContain('None are in a "holding pattern"');
        });

        it('detectUngroundedEngineeringHallucination catches the exact ungrounded narrative and related tropes', () => {
            const exactHallucination =
                'I have completed a board-wide audit of all 23 department heads. The results are consistent across the board: ' +
                'none of the specialized tools requested by the department heads have been implemented or delivered yet. ' +
                'The engineering team has acknowledged receipt of the master technical specification document for all 23 departments, ' +
                'but the build phase has not yet yielded any deployed tools. Every department head—from Legal and Finance to Marketing ' +
                'and Distribution—is still operating with their original, baseline capabilities. We are all currently in a holding pattern, ' +
                'waiting for the engineering sprint...';

            const detection = detectUngroundedEngineeringHallucination(exactHallucination);
            expect(detection.hasHallucination).toBe(true);
            expect(detection.matchedPattern).toBeDefined();

            // Sub-pattern tests
            expect(detectUngroundedEngineeringHallucination('We are currently in a holding pattern for the build.').hasHallucination).toBe(true);
            expect(detectUngroundedEngineeringHallucination('Waiting for the engineering sprint to start.').hasHallucination).toBe(true);
            expect(detectUngroundedEngineeringHallucination('The master technical specification document was received.').hasHallucination).toBe(true);
            expect(detectUngroundedEngineeringHallucination('None of the tools have been implemented yet.').hasHallucination).toBe(true);
            expect(detectUngroundedEngineeringHallucination('Operating with their original baseline capabilities.').hasHallucination).toBe(true);
        });

        it('detectUngroundedEngineeringHallucination ignores normal verified responses', () => {
            const normalResponse = 'Here is the campaign brief for your upcoming single release on Spotify.';
            expect(detectUngroundedEngineeringHallucination(normalResponse).hasHallucination).toBe(false);
        });

        it('sanitizeAgentCapabilityOutput replaces hallucinated output with the verified department audit report', () => {
            const hallucinated = 'Every department head is in a holding pattern waiting for the engineering sprint.';
            const sanitized = sanitizeAgentCapabilityOutput(hallucinated);
            expect(sanitized).not.toContain('waiting for the engineering sprint');
            expect(sanitized).toContain('Yes. All 23 department heads have their requested and specialized tools fully implemented');
        });
    });
});
