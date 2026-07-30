import { describe, expect, it } from 'vitest';
import { listHeadIds, listWorkerIds } from './departments';
import {
    getAgentColorContrast,
    resolveAgentVisualIdentity,
} from './AgentVisualIdentity';

const OPAQUE_HEX = /^#[0-9A-F]{6}$/;

describe('AgentVisualIdentity', () => {
    it('resolves every ISSUE-1291 canonical head without redefining the roster', () => {
        const heads = listHeadIds();
        const identities = heads.map(agentId => resolveAgentVisualIdentity(agentId));

        expect(identities).toHaveLength(23);
        expect(identities.map(identity => identity.agentId)).toEqual(heads);
        for (const identity of identities) {
            expect(identity.role).toBe('head');
            expect(identity.departmentId).toBe(identity.agentId);
            expect(identity.displayName).not.toBe('Unknown Agent');
            expect(identity.initials).toMatch(/^[A-Z&]{1,2}$/);
            expect(identity.iconKey).not.toBe('bot');
            expect(identity.ariaLabel).toContain(identity.displayName);
        }
    });

    it('keeps the Social seat identity exact and stable across every renderer', () => {
        const seat = resolveAgentVisualIdentity('social');
        const discussion = resolveAgentVisualIdentity('social');
        const directChat = resolveAgentVisualIdentity('social');

        expect(seat).not.toBe(discussion);
        expect(seat).toStrictEqual(discussion);
        expect(discussion).toStrictEqual(directChat);
        expect(seat).toMatchObject({
            agentId: 'social',
            displayName: 'Social Media Director',
            initials: 'SM',
            iconKey: 'share-2',
            departmentId: 'social',
            role: 'head',
            accent: '#00BCD4',
        });
        expect(seat.cssProperties['--agent-source-accent']).toBe(
            'var(--color-dept-social, #00BCD4)',
        );
        expect(resolveAgentVisualIdentity('social', { displayName: 'Runtime Override' })).toStrictEqual(seat);
    });

    it('gives Finance workers the department hue with a distinct stable lower-emphasis variant', () => {
        const head = resolveAgentVisualIdentity('finance');
        const worker = resolveAgentVisualIdentity('finance.tax');

        expect(worker).toStrictEqual(resolveAgentVisualIdentity('finance.tax'));
        expect(worker).toMatchObject({
            displayName: 'Tax Specialist',
            initials: 'TS',
            departmentId: 'finance',
            role: 'worker',
            iconKey: 'calculator',
        });
        expect(worker.cssProperties['--agent-source-accent']).toBe(
            head.cssProperties['--agent-source-accent'],
        );
        expect(worker.accent).not.toBe(head.accent);
        expect(getAgentColorContrast(worker.accent, worker.surface)).toBeGreaterThanOrEqual(3);
        expect(getAgentColorContrast(worker.accent, worker.surface)).toBeLessThan(
            getAgentColorContrast(head.accent, head.surface),
        );
    });

    it('uses an explicit neutral Bot fallback for unknown IDs and supports explicit aliases', () => {
        const unknown = resolveAgentVisualIdentity('provider-model-at-runtime');
        expect(unknown).toMatchObject({
            agentId: 'provider-model-at-runtime',
            displayName: 'Unknown Agent',
            initials: 'UA',
            iconKey: 'bot',
            departmentId: null,
            role: 'unknown',
        });
        expect(unknown.cssProperties['--agent-source-accent']).toBe(
            'var(--color-dept-neutral, #94A3B8)',
        );

        const aliased = resolveAgentVisualIdentity('tour-photographer', {
            displayName: 'Tour Photographer',
        });
        expect(aliased).toMatchObject({
            displayName: 'Tour Photographer',
            initials: 'TP',
            iconKey: 'bot',
            role: 'independent',
        });
    });

    it('returns immutable opaque contrast-safe tokens and decorative-only glow', () => {
        const sampleIds = [
            ...listHeadIds(),
            ...listWorkerIds(),
            'generalist',
            'analytics',
            'rights',
            'unknown-agent',
        ];

        for (const agentId of sampleIds) {
            const identity = resolveAgentVisualIdentity(agentId);
            expect(Object.isFrozen(identity)).toBe(true);
            expect(Object.isFrozen(identity.cssProperties)).toBe(true);
            for (const token of [
                identity.accent,
                identity.surface,
                identity.border,
                identity.foreground,
                identity.onAccentForeground,
            ]) {
                expect(token).toMatch(OPAQUE_HEX);
            }
            expect(identity.glow).toMatch(/^rgba\(\d+, \d+, \d+, 0\.\d+\)$/);
            expect(getAgentColorContrast(identity.foreground, identity.surface)).toBeGreaterThanOrEqual(4.5);
            expect(getAgentColorContrast(identity.onAccentForeground, identity.accent)).toBeGreaterThanOrEqual(4.5);
            expect(getAgentColorContrast(identity.border, identity.surface)).toBeGreaterThanOrEqual(3);
            expect(getAgentColorContrast(identity.accent, identity.surface)).toBeGreaterThanOrEqual(3);
        }
    });
});
