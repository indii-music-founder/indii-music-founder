import { describe, it, expect } from 'vitest';
import {
    DEPARTMENTS,
    getDepartmentOf,
    isHead,
    isWorker,
    isWorkerOf,
    sameDepartment,
    listHeadIds,
    listWorkerIds,
} from '../departments';

describe('Department registry — Phase 1 hierarchical agent system', () => {
    describe('coverage', () => {
        it('declares a department for every existing specialist agent', () => {
            const expectedHeads = [
                'finance', 'legal', 'distribution', 'marketing', 'brand',
                'music', 'video', 'social', 'publicist', 'publishing',
                'licensing', 'road', 'merchandise', 'creative', 'producer',
                'director', 'screenwriter', 'devops', 'security', 'curriculum',
                'keeper',
            ];
            const heads = listHeadIds().sort();
            expect(heads).toEqual(expectedHeads.sort());
        });

        it('Phase 1 ships zero workers, Phase 3 population begins with finance workers', () => {
            expect(listWorkerIds()).toHaveLength(3);
        });

        it('every department has exactly one head matching its id', () => {
            for (const dept of Object.values(DEPARTMENTS)) {
                expect(dept.headId).toBe(dept.id);
                expect(dept.workerIds).toBeInstanceOf(Array);
            }
        });
    });

    describe('isHead / isWorker', () => {
        it('returns true for known department heads', () => {
            expect(isHead('finance')).toBe(true);
            expect(isHead('legal')).toBe(true);
            expect(isHead('marketing')).toBe(true);
        });

        it('returns false for non-heads (workers, unknown ids)', () => {
            expect(isHead('finance.tax')).toBe(false);
            expect(isHead('not_a_real_agent')).toBe(false);
            expect(isHead('')).toBe(false);
        });

        it('isWorker reflects DEPARTMENTS.workerIds membership', () => {
            expect(isWorker('finance.tax')).toBe(true);
            expect(isWorkerOf('finance.tax', 'finance')).toBe(true);
            expect(isWorkerOf('finance.tax', 'legal')).toBe(false);
        });
    });

    describe('getDepartmentOf', () => {
        it('returns the department for a head', () => {
            expect(getDepartmentOf('finance')?.id).toBe('finance');
            expect(getDepartmentOf('legal')?.id).toBe('legal');
        });

        it('returns the department for a registered worker', () => {
            expect(getDepartmentOf('finance.royalty')?.id).toBe('finance');
        });

        it('returns null for unknown agent ids', () => {
            expect(getDepartmentOf('mystery')).toBeNull();
        });
    });

    describe('sameDepartment — drives DEPARTMENT_SCOPE_VIOLATION enforcement', () => {
        it('two heads of different departments are NOT the same department', () => {
            // Boardroom-mode cross-department traffic is allowed by seating rules,
            // but Department-mode would block this.
            expect(sameDepartment('finance', 'legal')).toBe(false);
            expect(sameDepartment('marketing', 'brand')).toBe(false);
        });

        it('a head and its own worker ARE the same department', () => {
            DEPARTMENTS.legal!.workerIds.push('legal.contracts');
            try {
                expect(sameDepartment('legal', 'legal.contracts')).toBe(true);
                expect(sameDepartment('legal.contracts', 'legal')).toBe(true);
            } finally {
                DEPARTMENTS.legal!.workerIds.pop();
            }
        });

        it('two workers in the same department ARE the same department', () => {
            DEPARTMENTS.finance!.workerIds.push('finance.tax', 'finance.royalty');
            try {
                expect(sameDepartment('finance.tax', 'finance.royalty')).toBe(true);
            } finally {
                DEPARTMENTS.finance!.workerIds.length = 0;
            }
        });

        it('workers from different departments are NOT the same department', () => {
            DEPARTMENTS.finance!.workerIds.push('finance.tax');
            DEPARTMENTS.legal!.workerIds.push('legal.contracts');
            try {
                expect(sameDepartment('finance.tax', 'legal.contracts')).toBe(false);
            } finally {
                DEPARTMENTS.finance!.workerIds.length = 0;
                DEPARTMENTS.legal!.workerIds.length = 0;
            }
        });

        it('returns false when either agent is unknown', () => {
            expect(sameDepartment('finance', 'unknown')).toBe(false);
            expect(sameDepartment('unknown', 'unknown2')).toBe(false);
        });
    });

    describe('Boardroom tier enforcement (drives BOARDROOM_TIER_VIOLATION)', () => {
        it('only heads can be seated; workers must be rejected', () => {
            DEPARTMENTS.finance!.workerIds.push('finance.tax');
            try {
                expect(isHead('finance')).toBe(true);
                expect(isHead('finance.tax')).toBe(false); // worker → BOARDROOM_TIER_VIOLATION
            } finally {
                DEPARTMENTS.finance!.workerIds.length = 0;
            }
        });
    });
});
