/**
 * Department Registry — two-tier hierarchy for hybrid Pattern 4.
 *
 * Each department has one head (existing specialist agent) and zero or more
 * workers (sub-agents). Heads team up across departments in Boardroom mode.
 * Workers team up only within their own department in Department mode.
 *
 * Worker agent IDs use dot-notation: "<deptId>.<workerName>" (e.g. "finance.tax").
 * Phase 1 ships all 17 heads as single-agent departments. Worker population is
 * incremental (Phase 3).
 */

import type { ValidAgentId } from './types';

export interface Department {
    id: string;
    headId: string;
    workerIds: string[];
    displayName: string;
}

export const DEPARTMENTS: Record<string, Department> = {
    finance:      { id: 'finance',      headId: 'finance',      workerIds: ['finance.accounting', 'finance.tax', 'finance.royalty'], displayName: 'Finance' },
    legal:        { id: 'legal',        headId: 'legal',        workerIds: [], displayName: 'Legal' },
    distribution: { id: 'distribution', headId: 'distribution', workerIds: [], displayName: 'Distribution' },
    marketing:    { id: 'marketing',    headId: 'marketing',    workerIds: [], displayName: 'Marketing' },
    brand:        { id: 'brand',        headId: 'brand',        workerIds: [], displayName: 'Brand' },
    music:        { id: 'music',        headId: 'music',        workerIds: [], displayName: 'Music' },
    video:        { id: 'video',        headId: 'video',        workerIds: [], displayName: 'Video' },
    social:       { id: 'social',       headId: 'social',       workerIds: [], displayName: 'Social' },
    publicist:    { id: 'publicist',    headId: 'publicist',    workerIds: [], displayName: 'Publicist' },
    publishing:   { id: 'publishing',   headId: 'publishing',   workerIds: [], displayName: 'Publishing' },
    licensing:    { id: 'licensing',    headId: 'licensing',    workerIds: [], displayName: 'Licensing' },
    road:         { id: 'road',         headId: 'road',         workerIds: [], displayName: 'Road' },
    merchandise:  { id: 'merchandise',  headId: 'merchandise',  workerIds: [], displayName: 'Merchandise' },
    creative:     { id: 'creative',     headId: 'creative',     workerIds: [], displayName: 'Creative' },
    producer:     { id: 'producer',     headId: 'producer',     workerIds: [], displayName: 'Producer' },
    director:     { id: 'director',     headId: 'director',     workerIds: [], displayName: 'Director' },
    screenwriter: { id: 'screenwriter', headId: 'screenwriter', workerIds: [], displayName: 'Screenwriter' },
    devops:       { id: 'devops',       headId: 'devops',       workerIds: [], displayName: 'DevOps' },
    security:     { id: 'security',     headId: 'security',     workerIds: [], displayName: 'Security' },
    curriculum:   { id: 'curriculum',   headId: 'curriculum',   workerIds: [], displayName: 'Curriculum' },
    keeper:       { id: 'keeper',       headId: 'keeper',       workerIds: [], displayName: 'Keeper' },
};

export function getDepartmentOf(agentId: string): Department | null {
    for (const dept of Object.values(DEPARTMENTS)) {
        if (dept.headId === agentId || dept.workerIds.includes(agentId)) {
            return dept;
        }
    }
    return null;
}

export function isHead(agentId: string): boolean {
    return Object.values(DEPARTMENTS).some(d => d.headId === agentId);
}

export function isWorker(agentId: string): boolean {
    return Object.values(DEPARTMENTS).some(d => d.workerIds.includes(agentId));
}

export function isWorkerOf(agentId: string, deptId: string): boolean {
    const dept = DEPARTMENTS[deptId];
    return !!dept && dept.workerIds.includes(agentId);
}

export function sameDepartment(agentA: string, agentB: string): boolean {
    const deptA = getDepartmentOf(agentA);
    const deptB = getDepartmentOf(agentB);
    return !!deptA && !!deptB && deptA.id === deptB.id;
}

/** All agent IDs that are department heads. */
export function listHeadIds(): string[] {
    return Object.values(DEPARTMENTS).map(d => d.headId);
}

/** All agent IDs that are workers across all departments. */
export function listWorkerIds(): string[] {
    return Object.values(DEPARTMENTS).flatMap(d => d.workerIds);
}

/** Type-narrow helper for using ValidAgentId list at runtime. */
export function isValidHeadId(agentId: string): agentId is ValidAgentId {
    return isHead(agentId);
}
