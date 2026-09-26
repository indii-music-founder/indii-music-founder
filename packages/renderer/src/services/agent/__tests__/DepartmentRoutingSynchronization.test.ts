import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DEPARTMENTS } from '../departments';
import {
    buildDepartmentAuditReport,
    isDepartmentAuditOrReadinessQuestion,
    detectUngroundedEngineeringHallucination,
} from '../capabilityTruth';

describe('DepartmentRoutingSynchronization & Capability Truth Architectural Guard', () => {
    it('ensures all registered departments in departments.ts are present in Conductor prompt routing table', () => {
        // Resolve path to agents/conductor/prompt.md
        const possiblePaths = [
            path.resolve(process.cwd(), 'agents/conductor/prompt.md'),
            path.resolve(process.cwd(), '../../agents/conductor/prompt.md'),
            path.resolve(__dirname, '../../../../../../agents/conductor/prompt.md'),
        ];
        const promptPath = possiblePaths.find(p => fs.existsSync(p));
        expect(promptPath, 'Could not locate agents/conductor/prompt.md').toBeDefined();

        const promptContent = fs.readFileSync(promptPath!, 'utf-8');
        const departmentKeys = Object.keys(DEPARTMENTS);

        expect(departmentKeys.length).toBeGreaterThanOrEqual(23);

        const missingInConductorRouting: string[] = [];
        for (const deptKey of departmentKeys) {
            // Check that the prompt table includes the targetAgentId
            const tableEntryRegex = new RegExp(String.raw`\|\s*${deptKey}\s*\|`, 'i');
            if (!tableEntryRegex.test(promptContent)) {
                missingInConductorRouting.push(deptKey);
            }
        }

        expect(
            missingInConductorRouting,
            `Departments defined in departments.ts missing from Conductor prompt routing table: ${missingInConductorRouting.join(', ')}`
        ).toEqual([]);
    });

    it('ensures buildDepartmentAuditReport keeps the honest non-certification contract (ISSUE-1447)', () => {
        // ISSUE-1447: 129ee4611 deliberately replaced the blanket "all 23
        // departments operational" enumeration with a truthful non-certification
        // answer. Department coverage is guarded by the Conductor routing-table
        // test above; this guard now locks the HONESTY contract instead.
        const report = buildDepartmentAuditReport();

        expect(report).toContain('cannot truthfully certify every department');
        expect(report).toContain('will not claim that all 23 departments are fully verified');
        expect(report).toContain('will not claim there are no pending engineering items');
        expect(report).toContain('available, degraded, blocked, or unverified');
        // The abandoned blanket claim must never return:
        expect(report).not.toContain('All 23 department heads have their requested and specialized tools fully implemented');
    });

    it('intercepts abstract variations of audit and readiness questions', () => {
        const abstractQuestions = [
            'how are the other 23 agents doing',
            'are all 23 departments ready and operational',
            'give me a status of the other agents',
            'are there any tool deficits across the team',
            'is any agent waiting on an engineering sprint',
            'did the other 23 get their tools',
            'what is the build phase status of the departments',
        ];

        for (const q of abstractQuestions) {
            expect(
                isDepartmentAuditOrReadinessQuestion(q),
                `Expected "${q}" to be recognized as an audit/readiness question`
            ).toBe(true);
        }
    });

    it('detects and intercepts corporate deficit tropes and escalation text', () => {
        const hallucinatedTexts = [
            'We are currently in a holding pattern waiting for the engineering sprint.',
            'None of the specialized tools have been implemented yet.',
            'Operations remain restricted to the core visual suite.',
            'Tool Deficit: Nine advanced tools essential for a professional-grade workflow are currently unavailable.',
            'The technical roadmap remains unchanged as it awaits further engineering development.',
            'This matter is being escalated to a human professional for further review.',
        ];

        for (const text of hallucinatedTexts) {
            const check = detectUngroundedEngineeringHallucination(text);
            expect(
                check.hasHallucination,
                `Expected "${text}" to be flagged as ungrounded engineering hallucination`
            ).toBe(true);
        }
    });
});
