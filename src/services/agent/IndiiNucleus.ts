/**
 * IndiiNucleus — The Identity Engine
 *
 * Assembles the full indii persona from Living Files (SOUL, ARTIST, SHOWROOM, PULSE)
 * and executes requests natively through Gemini via GenAI — no external container.
 *
 * Previously this acted as a DNA-injection layer on top of an external Agent Zero
 * container. That dependency has been removed. indii now runs on its own runtime.
 */
import { livingFileService } from './living/LivingFileService';
import { memoryService } from './MemoryService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { GenAI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';

export interface NucleusContext {
  soul: string;
  artist: string;
  showroom: string;
  pulse: string;
  memories: string[];
}

export interface NucleusResponse {
  message: string;
  attachments?: string[];
}

export interface NucleusExecutionResult {
  response: NucleusResponse;
  context: NucleusContext;
  dnaInjected: boolean;
}

export class IndiiNucleus {
  /**
   * Build the full indii system prompt from Living Files.
   */
  async spliceDNA(userId: string): Promise<string> {
    try {
      const [soul, artist, showroom] = await Promise.all([
        livingFileService.read(userId, 'SOUL'),
        livingFileService.read(userId, 'ARTIST'),
        livingFileService.read(userId, 'SHOWROOM')
      ]);

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
    2. **CLOSED GARDEN EXECUTION:** You only use the tools provided in your 'Studio Skills' library.
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
   * Execute a request through the native Gemini runtime with full indii DNA injected.
   * All requests are handled by GenAI — no external sidecar required.
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
      throw new Error('[IndiiNucleus] No authenticated user — cannot build context');
    }

    const [dnaPrompt, context] = await Promise.all([
      this.spliceDNA(userId),
      this.buildContext(userId, options?.projectId, userMessage),
    ]);

    let memoryBlock = '';
    if (context.memories.length > 0) {
      memoryBlock = `\n\n<long_term_memory>\n${context.memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n</long_term_memory>`;
    }

    const systemPrompt = `${dnaPrompt}${memoryBlock}`;

    // Build multimodal parts — text + optional image attachments
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: userMessage }
    ];

    if (options?.attachments) {
      for (const att of options.attachments) {
        const ext = att.filename.split('.').pop()?.toLowerCase() ?? '';
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg',
          png: 'image/png', webp: 'image/webp',
          pdf: 'application/pdf', txt: 'text/plain',
        };
        const mimeType = mimeMap[ext] ?? 'application/octet-stream';
        parts.push({ inlineData: { mimeType, data: att.base64 } });
      }
    }

    const responseText = await GenAI.generateContent(
      [{ role: 'user', parts }],
      AI_MODELS.TEXT_AGENT,
      { systemInstruction: systemPrompt }
    );

    // Log to EPISODIC (non-blocking)
    try {
      const summary = userMessage.length > 100
        ? `${userMessage.substring(0, 100)}...`
        : userMessage;
      await livingFileService.appendToEpisodic(userId, `Nucleus executed: "${summary}" → indii responded`);
    } catch (error) {
      logger.warn('[IndiiNucleus] Episodic logging failed:', error);
    }

    return {
      response: { message: responseText },
      context,
      dnaInjected: true
    };
  }

  /**
   * Generate a heartbeat prompt for the Pulse Engine.
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
