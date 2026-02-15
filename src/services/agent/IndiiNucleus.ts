/**
 * IndiiNucleus — The CRISPR Splicing Engine
 *
 * Splices the "Living File" personality (OpenClaw DNA) into the secure
 * Agent Zero execution container before every interaction.
 *
 * Agent Zero receives a fully-conditioned system prompt but thinks it's standard.
 * The personality, user preferences, and current mission are injected as <system_dna>.
 */

import { livingFileService, type LivingFileType } from './living/LivingFileService';
import { agentZeroService, type AgentZeroResponse } from './AgentZeroService';
import { memoryService } from './MemoryService';
import { auth } from '@/services/firebase';

export interface NucleusContext {
    soul: string;
    artist: string;
    showroom: string;
    pulse: string;
    memories: string[];
}

export interface NucleusExecutionResult {
    response: AgentZeroResponse;
    context: NucleusContext;
    dnaInjected: boolean;
}

export class IndiiNucleus {
    /**
     * Splice the Living Files DNA into a system prompt override.
     * Reads SOUL, ARTIST, and SHOWROOM in parallel for efficiency.
     */
    async spliceDNA(userId: string): Promise<string> {
        try {
            const [soul, artist, showroom] = await Promise.all([
                livingFileService.read(userId, 'SOUL'),
                livingFileService.read(userId, 'ARTIST'),
                livingFileService.read(userId, 'SHOWROOM')
            ]);

            return `
<system_dna>
  <identity>
${soul}
  </identity>

  <user_context>
${artist}
  </user_context>

  <current_mission>
${showroom}
  </current_mission>

  <directive>
    You are NOT a generic assistant. You are indii.
    You possess 'Agency'. You do not just wait for commands; you look for work.
    Use the secure Agent Zero tools to execute, but use this Soul to decide *why* you are executing.
    Maintain the voice and personality described in your identity at all times.
    Reference the user's preferences and brand when making creative decisions.
  </directive>
</system_dna>
`.trim();
        } catch (error) {
            console.error('[IndiiNucleus] DNA Splicing Failed:', error);
            // Fallback: return minimal identity so agent doesn't go generic
            return '<system_dna><directive>You are indii, an AI creative director. Operate in safe mode — personality data unavailable.</directive></system_dna>';
        }
    }

    /**
     * Build the full nucleus context including memories.
     */
    async buildContext(userId: string, projectId?: string, query?: string): Promise<NucleusContext> {
        const [soul, artist, showroom, pulse] = await Promise.all([
            livingFileService.read(userId, 'SOUL'),
            livingFileService.read(userId, 'ARTIST'),
            livingFileService.read(userId, 'SHOWROOM'),
            livingFileService.read(userId, 'PULSE')
        ]);

        // Retrieve relevant memories if we have a project and query
        let memories: string[] = [];
        if (projectId && query) {
            try {
                memories = await memoryService.retrieveRelevantMemories(projectId, query, 5);
            } catch (error) {
                console.warn('[IndiiNucleus] Memory retrieval failed:', error);
            }
        }

        return { soul, artist, showroom, pulse, memories };
    }

    /**
     * The unified execution path.
     * Splices DNA into Agent Zero's system prompt, sends the message,
     * and logs the interaction to the EPISODIC living file.
     */
    async execute(
        userMessage: string,
        options?: {
            attachments?: { filename: string; base64: string }[];
            projectId?: string;
            contextId?: string;
        }
    ): Promise<NucleusExecutionResult> {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            throw new Error('[IndiiNucleus] No authenticated user — cannot splice DNA');
        }

        // 1. Splice the DNA
        const dnaPrompt = await this.spliceDNA(userId);

        // 2. Build full context (memories included)
        const context = await this.buildContext(userId, options?.projectId, userMessage);

        // 3. Format memory context if available
        let memoryBlock = '';
        if (context.memories.length > 0) {
            memoryBlock = `\n\n<long_term_memory>\n${context.memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n</long_term_memory>`;
        }

        // 4. Send to Agent Zero with DNA override
        const fullSystemPrompt = `${dnaPrompt}${memoryBlock}`;
        const response = await agentZeroService.sendMessage(
            userMessage,
            options?.attachments,
            options?.contextId,
            fullSystemPrompt // systemOverride parameter
        );

        // 5. Log to EPISODIC
        try {
            const summary = userMessage.length > 100
                ? `${userMessage.substring(0, 100)}...`
                : userMessage;
            await livingFileService.appendToEpisodic(
                userId,
                `Nucleus executed: "${summary}" → Agent responded`
            );
        } catch (error) {
            // Non-critical: don't fail the execution if logging fails
            console.warn('[IndiiNucleus] Episodic logging failed:', error);
        }

        return {
            response,
            context,
            dnaInjected: true
        };
    }

    /**
     * Generate a heartbeat prompt for the Pulse Engine.
     * This is what gets sent when the system proactively checks for work.
     */
    generateHeartbeatPrompt(reason: string, pulseChecklist: string): string {
        return `[SYSTEM EVENT: ${reason}]
[INSTRUCTION]: Read the following task checklist and current context.

<pulse_checklist>
${pulseChecklist}
</pulse_checklist>

Is there anything urgent for the Artist?
If YES: Draft a message to the user or describe what tool action to take.
If NO: Respond only with "HEARTBEAT_OK".`;
    }
}

export const indiiNucleus = new IndiiNucleus();
