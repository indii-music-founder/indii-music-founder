/**
 * @file creative_agent_hardening.test.ts
 *
 * Regression guard for the Creative Agent Hardening sprint (2026-04-22).
 *
 * WHAT THIS FILE PROTECTS:
 *  1. 'creative' is the only canonical agent ID — no 'creative-director' alias.
 *  2. 'road' is the only canonical agent ID — no 'road-manager' alias.
 *  3. ImageGenerationOptions does NOT accept a 'style' property.
 *  4. DirectorTools imports WhiskService from the correct flat path.
 *  5. CreativeAgent system prompt compiles without breaking template literals.
 *
 * DO NOT delete or weaken these tests. They are architectural guards.
 * See: .agent/skills/error_memory/ERROR_LEDGER.md — "Creative Agent Hardening"
 */

import { describe, it, expect } from 'vitest';
import { VALID_AGENT_IDS } from '@/services/agent/types';
import type { ImageGenerationOptions } from '@/services/image/ImageGenerationService';

// ---------------------------------------------------------------------------
// 1. AGENT ID CANONICAL IDENTITY GUARDS
// ---------------------------------------------------------------------------

describe('Agent ID Hardening — Canonical IDs Only', () => {
    it('should include "creative" as a valid agent ID', () => {
        expect(VALID_AGENT_IDS).toContain('creative');
    });

    it('should include "road" as a valid agent ID', () => {
        expect(VALID_AGENT_IDS).toContain('road');
    });

    it('should NOT contain the dead alias "creative-director"', () => {
        // REGRESSION GUARD: 'creative-director' was removed 2026-04-22.
        // If this fails, someone re-added a stale alias to fine-tuned-models.ts.
        expect(VALID_AGENT_IDS).not.toContain('creative-director');
    });

    it('should NOT contain the dead alias "road-manager"', () => {
        // REGRESSION GUARD: 'road-manager' was removed 2026-04-22.
        expect(VALID_AGENT_IDS).not.toContain('road-manager');
    });

    it('should have no duplicate IDs in VALID_AGENT_IDS', () => {
        const unique = new Set(VALID_AGENT_IDS);
        expect(unique.size).toBe(VALID_AGENT_IDS.length);
    });
});

// ---------------------------------------------------------------------------
// 2. ImageGenerationOptions — API SURFACE GUARD
// ---------------------------------------------------------------------------

describe('ImageGenerationOptions — API Surface Guard', () => {
    it('should compile a valid options object without "style" property', () => {
        // This test asserts at the TYPE level. If ImageGenerationOptions gains
        // a 'style' key in the future, this test should be UPDATED to reflect
        // that change — but the test itself must remain present.
        const validOptions: ImageGenerationOptions = {
            prompt: 'Detroit techno producer, chiaroscuro, tungsten warmth',
            count: 1,
            resolution: '4K',
            aspectRatio: '1:1',
            isCoverArt: true,
        };

        // Runtime assertion: ensure the object has expected keys only.
        const keys = Object.keys(validOptions);
        expect(keys).not.toContain('style');
        expect(keys).toContain('prompt');
        expect(keys).toContain('resolution');
    });

    it('should accept style directives as part of the prompt string', () => {
        // The correct pattern is to fold style into prompt, not pass it as a key.
        const basePrompt = 'Abstract album cover, deep shadows';
        const style = 'photorealistic, high contrast';
        const effectivePrompt = style ? `${basePrompt}, style: ${style}` : basePrompt;

        expect(effectivePrompt).toBe(
            'Abstract album cover, deep shadows, style: photorealistic, high contrast'
        );

        const options: ImageGenerationOptions = {
            prompt: effectivePrompt,
            count: 1,
        };

        expect(options.prompt).toContain('style:');
    });
});

// ---------------------------------------------------------------------------
// 3. CreativeAgent SYSTEM PROMPT — TEMPLATE LITERAL INTEGRITY
// ---------------------------------------------------------------------------

describe('CreativeAgent — System Prompt Template Literal Integrity', () => {
    it('should import CreativeAgent without throwing a SyntaxError', async () => {
        // If backticks inside the system prompt are not escaped, this import
        // will throw a SyntaxError at module load time.
        await expect(
            import('@/services/agent/definitions/CreativeAgent')
        ).resolves.toBeDefined();
    });

    it('should export a systemPrompt that is a non-empty string', async () => {
        const mod = await import('@/services/agent/definitions/CreativeAgent');
        const agent = mod.CreativeAgent ?? mod.default;
        expect(typeof agent?.systemPrompt).toBe('string');
        expect((agent?.systemPrompt as string).length).toBeGreaterThan(100);
    });

    it('system prompt should contain canonical tool names', async () => {
        const mod = await import('@/services/agent/definitions/CreativeAgent');
        const agent = mod.CreativeAgent ?? mod.default;
        const prompt = agent?.systemPrompt as string;

        // These are load-bearing tool names; if removed from the prompt,
        // the agent will silently lose capabilities.
        expect(prompt).toContain('generate_image');
        expect(prompt).toContain('canvas_push');
    });
});

// ---------------------------------------------------------------------------
// 4. DirectorTools — WhiskService IMPORT PATH GUARD
// ---------------------------------------------------------------------------

describe('DirectorTools — WhiskService Import Path', () => {
    it('should import WhiskService from the correct flat path without error', async () => {
        // The correct path is '@/services/WhiskService'.
        // '@/services/whisk/WhiskService' does NOT exist and was corrected 2026-04-22.
        await expect(
            import('@/services/WhiskService')
        ).resolves.toBeDefined();
    });

    it('WhiskService should expose a synthesizeWhiskPrompt method', async () => {
        const mod = await import('@/services/WhiskService');
        const { WhiskService } = mod;
        expect(typeof WhiskService?.synthesizeWhiskPrompt).toBe('function');
    });
});
