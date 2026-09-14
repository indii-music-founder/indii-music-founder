/**
 * packages/renderer/src/services/agent/skills/ProductSkillRegistry.test.ts
 *
 * Unit test suite for ProductSkillRegistry.
 */

import { describe, it, expect } from 'vitest';
import { ProductSkillRegistry, parseSkillDocument, ProductSkill } from './ProductSkillRegistry';
import { consult_product_skill, list_product_skills } from '../tools/SwarmTools';

describe('ProductSkillRegistry', () => {
    describe('parseSkillDocument', () => {
        it('parses complete YAML frontmatter according to Agent Skills standard', () => {
            const raw = `---
name: digital_distribution
description: DSP ingestion, DDEX standards, and ISRC allocation.
user-invocable: true
disable-model-invocation: false
argument-hint: "<isrc_code> <release_date>"
allowed-tools:
  - generate_release_identifiers
  - compile_release_harness
trigger_labels:
  - dsp
  - isrc
  - spotify
---

# Digital Distribution & DSP Ingestion
Core playbook instructions for distribution.
`;
            const skill = parseSkillDocument('digital_distribution', raw);

            expect(skill.id).toBe('digital_distribution');
            expect(skill.name).toBe('digital_distribution');
            expect(skill.description).toBe('DSP ingestion, DDEX standards, and ISRC allocation.');
            expect(skill.userInvocable).toBe(true);
            expect(skill.disableModelInvocation).toBe(false);
            expect(skill.argumentHint).toBe('<isrc_code> <release_date>');
            expect(skill.allowedTools).toEqual(['generate_release_identifiers', 'compile_release_harness']);
            expect(skill.triggerLabels).toContain('dsp');
            expect(skill.triggerLabels).toContain('isrc');
            expect(skill.triggerLabels).toContain('spotify');
            expect(skill.triggerLabels).toContain('digital_distribution');
            expect(skill.body).toContain('# Digital Distribution & DSP Ingestion');
        });

        it('handles non-frontmatter documents gracefully using markdown body fallbacks', () => {
            const raw = `# Product Playbook: Business Harness System

This playbook instructs the studio's runtime agents on how to safely interact with, compile, and reason about the indii.music Business Harness.

## Core Directives
1. Deterministic First.
`;
            const skill = parseSkillDocument('business_harness_system', raw);

            expect(skill.id).toBe('business_harness_system');
            expect(skill.name).toBe('business_harness_system');
            expect(skill.userInvocable).toBe(true);
            expect(skill.disableModelInvocation).toBe(false);
            expect(skill.description).toContain('This playbook instructs');
            expect(skill.triggerLabels).toContain('business_harness_system');
            expect(skill.body).toBe(raw);
        });

        it('parses dual-state invocation security flags (disable-model-invocation: true)', () => {
            const raw = `---
name: high_risk_takedown
description: Execute legal DMCA takedown notice.
user-invocable: true
disable-model-invocation: true
---

# High Risk Takedown
Requires human confirmation.
`;
            const skill = parseSkillDocument('high_risk_takedown', raw);

            expect(skill.disableModelInvocation).toBe(true);
            expect(skill.userInvocable).toBe(true);
        });
    });

    describe('Registry Lookups and Mapping', () => {
        it('loads bundled Conductor skills at runtime', () => {
            const allSkills = ProductSkillRegistry.getAllProductSkills();
            expect(allSkills.length).toBeGreaterThanOrEqual(20);

            const distSkill = ProductSkillRegistry.getProductSkill('digital_distribution');
            expect(distSkill).toBeDefined();
            expect(distSkill?.name).toBe('digital_distribution');

            const legalSkill = ProductSkillRegistry.getProductSkill('legal_affairs');
            expect(legalSkill).toBeDefined();
            expect(legalSkill?.name).toBe('legal_affairs');
        });

        it('maps UI module IDs to domain skills', () => {
            const distSkill = ProductSkillRegistry.getSkillForModule('distribution');
            expect(distSkill).toBeDefined();
            expect(distSkill?.id).toBe('digital_distribution');

            const legalSkill = ProductSkillRegistry.getSkillForModule('legal');
            expect(legalSkill).toBeDefined();
            expect(legalSkill?.id).toBe('legal_affairs');

            const financeSkill = ProductSkillRegistry.getSkillForModule('finance');
            expect(financeSkill).toBeDefined();
            expect(financeSkill?.id).toBe('finance_royalties');
        });

        it('maps agent IDs to domain skills', () => {
            const creativeSkill = ProductSkillRegistry.getSkillForAgent('creative');
            expect(creativeSkill).toBeDefined();
            expect(creativeSkill?.id).toBe('creative_direction');

            const roadSkill = ProductSkillRegistry.getSkillForAgent('road');
            expect(roadSkill).toBeDefined();
            expect(roadSkill?.id).toBe('tour_management');
        });

        it('supports manual registration for tests', () => {
            const customSkill: ProductSkill = {
                id: 'custom_test_skill',
                name: 'Custom Test Skill',
                description: 'A custom skill for unit testing.',
                userInvocable: true,
                disableModelInvocation: false,
                triggerLabels: ['custom', 'test_trigger'],
                body: 'Custom playbook instructions.',
                rawContent: 'Custom playbook instructions.'
            };

            ProductSkillRegistry.registerSkill(customSkill);

            expect(ProductSkillRegistry.getProductSkill('custom_test_skill')).toEqual(customSkill);
            expect(ProductSkillRegistry.getProductSkill('custom test skill')).toEqual(customSkill);
        });
    });

    describe('searchProductSkillByIntent', () => {
        it('resolves slash commands directly', () => {
            const skill = ProductSkillRegistry.searchProductSkillByIntent('/digital_distribution');
            expect(skill).toBeDefined();
            expect(skill?.id).toBe('digital_distribution');
        });

        it('matches trigger labels using word boundaries', () => {
            const customSkill: ProductSkill = {
                id: 'sync_test',
                name: 'Sync Licensing',
                description: 'Sync brief placement and pitch.',
                userInvocable: true,
                disableModelInvocation: false,
                triggerLabels: ['sync_pitch', 'brief'],
                body: 'Sync instructions.',
                rawContent: 'Sync instructions.'
            };
            ProductSkillRegistry.registerSkill(customSkill);

            const result = ProductSkillRegistry.searchProductSkillByIntent('I need to prepare a brief for Netflix');
            expect(result).toBeDefined();
            expect(result?.id).toBe('sync_test');
        });

        it('falls back to matching skill name or ID', () => {
            const result = ProductSkillRegistry.searchProductSkillByIntent('how do I handle legal affairs?');
            expect(result).toBeDefined();
            expect(result?.id).toBe('legal_affairs');
        });

        it('returns undefined when no intent or query matches', () => {
            const result = ProductSkillRegistry.searchProductSkillByIntent('');
            expect(result).toBeUndefined();
        });
    });

    describe('formatSkillForPrompt', () => {
        it('formats product skill into structured XML context block', () => {
            const skill: ProductSkill = {
                id: 'format_test',
                name: 'Format Test Skill',
                description: 'Testing XML formatting',
                userInvocable: true,
                disableModelInvocation: false,
                argumentHint: '<arg1>',
                allowedTools: ['tool_a', 'tool_b'],
                triggerLabels: ['format'],
                body: 'Step 1: Do something.\nStep 2: Complete.',
                rawContent: ''
            };

            const formatted = ProductSkillRegistry.formatSkillForPrompt(skill);

            expect(formatted).toContain('<active_product_skill id="format_test" name="Format Test Skill">');
            expect(formatted).toContain('<description>Testing XML formatting</description>');
            expect(formatted).toContain('<argument_hint><arg1></argument_hint>');
            expect(formatted).toContain('<allowed_tools>tool_a, tool_b</allowed_tools>');
            expect(formatted).toContain('<playbook>');
            expect(formatted).toContain('Step 1: Do something.');
            expect(formatted).toContain('</active_product_skill>');
        });
    });

    describe('SwarmTools Integration', () => {
        interface SkillDataShape {
            id?: string;
            body?: string;
            count?: number;
            skills?: unknown[];
        }

        it('consult_product_skill loads an authoritative playbook', async () => {
            const result = await consult_product_skill({ skillName: 'digital_distribution' });
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            const data = result.data as SkillDataShape;
            expect(data.id).toBe('digital_distribution');
            expect(data.body).toContain('ISRC');
        });

        it('consult_product_skill searches by intent if name not matched directly', async () => {
            const result = await consult_product_skill({ skillName: '', query: 'contracts and 360 deals' });
            expect(result.success).toBe(true);
            const data = result.data as SkillDataShape;
            expect(data.id).toBe('legal_affairs');
        });

        it('consult_product_skill returns error for non-existent skills', async () => {
            const result = await consult_product_skill({ skillName: 'non_existent_skill_xyz' });
            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('list_product_skills returns catalog of all bundled skills', async () => {
            const result = await list_product_skills({});
            expect(result.success).toBe(true);
            const data = result.data as SkillDataShape;
            expect(data.count).toBeGreaterThanOrEqual(20);
            expect(data.skills?.length).toBeGreaterThanOrEqual(20);
        });
    });
});
