import { describe, it, expect, beforeEach } from 'vitest';
import {
    DEFAULT_AGENT_VOICES,
    GEMINI_TTS_VOICES,
    CURATED_VOICE_OPTIONS,
    resolveAgentVoice,
    isGeminiTTSVoice,
    stripMarkdownForSpeech,
    loadPersistedVoiceOverrides,
    savePersistedVoiceOverrides,
} from '../AgentVoiceRegistry';
import { VALID_AGENT_IDS } from '../types';

describe('AgentVoiceRegistry', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('assigns a valid Gemini TTS voice to all 31 VALID_AGENT_IDS', () => {
        for (const agentId of VALID_AGENT_IDS) {
            const voice = DEFAULT_AGENT_VOICES[agentId];
            expect(voice).toBeDefined();
            expect(GEMINI_TTS_VOICES).toContain(voice);
        }
    });

    it('resolves default voice when no override is present', () => {
        expect(resolveAgentVoice('creative')).toBe('Aoede');
        expect(resolveAgentVoice('finance')).toBe('Charon');
        expect(resolveAgentVoice('generalist')).toBe('Kore');
        expect(resolveAgentVoice(null)).toBe('Kore');
        expect(resolveAgentVoice(undefined)).toBe('Kore');
    });

    it('resolves explicit override passed in options', () => {
        const overrides = { creative: 'Puck' };
        expect(resolveAgentVoice('creative', overrides)).toBe('Puck');
        // Un-overridden agent keeps default
        expect(resolveAgentVoice('finance', overrides)).toBe('Charon');
    });

    it('persists and loads voice overrides from localStorage', () => {
        savePersistedVoiceOverrides({ marketing: 'Zephyr' });
        const loaded = loadPersistedVoiceOverrides();
        expect(loaded.marketing).toBe('Zephyr');
        expect(resolveAgentVoice('marketing')).toBe('Zephyr');
    });

    it('validates Gemini TTS voice names accurately', () => {
        expect(isGeminiTTSVoice('Kore')).toBe(true);
        expect(isGeminiTTSVoice('Aoede')).toBe(true);
        expect(isGeminiTTSVoice('InvalidVoice123')).toBe(false);
        expect(isGeminiTTSVoice(null)).toBe(false);
    });

    it('provides distinct sample lines and tones for all curated voices', () => {
        expect(CURATED_VOICE_OPTIONS.length).toBe(8);
        for (const opt of CURATED_VOICE_OPTIONS) {
            expect(GEMINI_TTS_VOICES).toContain(opt.voice);
            expect(opt.tone.length).toBeGreaterThan(0);
            expect(opt.sampleLine.length).toBeGreaterThan(0);
        }
    });

    it('cleans markdown, code blocks, links, and tool blocks for speech playback', () => {
        const complexMarkdown = `
# Executive Overview
Here is the plan for [Track 1](https://example.com/track):
\`\`\`typescript
const x = 42;
\`\`\`
[Tool: run_audit]
{"status": "ok"}
[End Tool run_audit]
We have **verified** all _royalties_ and splits!
Visit https://example.com for more.
        `;

        const speech = stripMarkdownForSpeech(complexMarkdown);
        expect(speech).not.toContain('```');
        expect(speech).not.toContain('const x = 42');
        expect(speech).not.toContain('[Tool:');
        expect(speech).not.toContain('[End Tool');
        expect(speech).not.toContain('https://');
        expect(speech).toContain('Executive Overview');
        expect(speech).toContain('Track 1');
        expect(speech).toContain('verified all royalties and splits!');
    });
});
