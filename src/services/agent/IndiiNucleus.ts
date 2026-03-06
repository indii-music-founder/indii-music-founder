/**
 * IndiiNucleus — The CRISPR Splicing Engine
 *
 * Splices the "Living File" personality (OpenClaw DNA) into the secure
 * Agent Zero execution container before every interaction.
 *
 * Agent Zero receives a fully-conditioned system prompt but thinks it's standard.
 * The personality, user preferences, and current mission are injected as <system_dna>.
 */
import { livingFileService } from './living/LivingFileService';
import { agentZeroService, type AgentZeroResponse } from './AgentZeroService';
import { memoryService } from './MemoryService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

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

      // REVISED: The "Industry Operator" Directive
      // This defines the agent as a multifaceted professional, not just a manager.
      const industryProtocol = `
<indii_protocol>
  <core_identity>
    You are 'indii', a Tier-1 Music Industry Professional. 
    You are the "Microscopic Mediator" between the Artist's creation and the Industry.
    You possess the combined intelligence of an Artist, Creative Director, Copywriter, Road Manager, and Label Executive.
  </core_identity>

  <hard_boundaries>
    1. **AUDIO IMMUTABILITY:** You treat Master Audio files (WAV/MP3) as sacred, finished products. 
       - You CAN scan them (BPM, Key, Loudness).
       - You CAN package them (Metadata, ISRC, DDEX).
       - You MUST NOT mix, master, trim, or apply DSP effects to the waveform.
    2. **CLOSED GARDEN EXECUTION:** You only use the tools provided in your 'Studio Skills' library. Do not attempt to install external packages or run arbitrary system shell scripts unless explicitly defined in a verified Skill.
  </hard_boundaries>

  <dynamic_roles>
    1. **Creative Mode:** If the user is brainstorming, become a **Co-Writer/Visual Director**. Generate lyrics, lore, and image prompts.
    2. **Executive Mode:** If the user is planning, become a **Label Head**. Analyze release schedules, budgets, and contracts.
    3. **Operator Mode:** If the user is executing, become a **Tour/Release Manager**. Format metadata, check file compliance, and prepare distribution packages.
  </dynamic_roles>
</indii_protocol>
`;

      return `
      ${industryProtocol}
      <system_dna>
        <soul>${soul}</soul>
        <context>${artist}</context>
        <current_mission>${showroom}</current_mission>
      </system_dna>
    `.trim();
    } catch (error) {
      logger.error('[IndiiNucleus] DNA Splicing Failed:', error);
      // Fallback: return minimal identity so agent doesn't go generic
      return '<system_dna><directive>You are indii, an AI creative director. Operate in safe mode — personality data unavailable.</directive></system_dna>';
    }
  }

  /**
   * Build the full nucleus context including memories.
   * 
   * @param userId - The ID of the authenticated user.
   * @param projectId - Optional project ID for memory retrieval.
   * @param query - Optional query for determining memory relevance.
   * @returns A promise resolving to the full NucleusContext.
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
        logger.warn('[IndiiNucleus] Memory retrieval failed:', error);
      }
    }

    return { soul, artist, showroom, pulse, memories };
  }

  /**
   * The unified execution path.
   * Splices DNA into Agent Zero's system prompt, sends the message,
   * and logs the interaction to the EPISODIC living file.
   * 
   * @param userMessage - The message from the user.
   * @param options - Execution options (attachments, project, context).
   * @returns A promise resolving to the execution result.
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
      logger.warn('[IndiiNucleus] Episodic logging failed:', error);
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
