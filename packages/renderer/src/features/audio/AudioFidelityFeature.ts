/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

// Schema for input validation
export const AudioFidelitySchema = z.object({
  filePath: z.string().min(1, "File path is required"),
  targetStandard: z.enum(["CD", "Hi-Res", "Atmos"]).optional().default("Hi-Res"),
  // Optional: pythonPath for environment configuration
  pythonPath: z.string().optional().default('python3'),
});

export type AudioFidelityInput = z.input<typeof AudioFidelitySchema>;
export type AudioFidelityOptions = z.output<typeof AudioFidelitySchema>; // The internal full options

export interface AudioFidelityResult {
  success: boolean;
  data?: {
    file: string;
    format: string;
    sample_rate: string;
    bit_depth: string;
    channels: number;
    compliance: {
      CD_Quality: boolean;
      Hi_Res: boolean;
      Atmos_Ready: boolean;
    };
    summary_status: string;
    error?: string;
  };
  error?: string;
}

/**
 * Feature: Audio Fidelity Audit
 * Wraps the execution/audio/audio_fidelity_audit.py script.
 * Ensures strict input validation and standardized output.
 */
export class AudioFidelityFeature {

  /**
   * Executes the Audio Fidelity Audit process.
   * @param options The audit options (filePath, targetStandard)
   * @returns Standardized result object
   */
  async execute(options: AudioFidelityInput): Promise<AudioFidelityResult> {
    // 1. Validation
    const validation = AudioFidelitySchema.safeParse(options);
    if (!validation.success) {
      return {
        success: false,
        error: `Validation Error: ${validation.error.issues.map(i => i.message).join(', ')}`
      };
    }

    const { filePath, targetStandard, pythonPath } = validation.data;

    // 2. Path resolution
    const path = await import('path');
    // NOTE: In a hybrid app, we import from the electron utils if in Node context
    // This assumes the feature is executing in the main process as per its design note.
    const { AgentSupervisor } = await import('../../../../main/src/utils/AgentSupervisor');

    const scriptName = 'audio_fidelity_audit.py';

    // 3. Execution via AgentSupervisor
    try {
      const result: any = await AgentSupervisor.runScript(
        'audio',
        scriptName,
        [filePath, targetStandard],
        undefined, // onProgress
        { PYTHON_PATH: pythonPath } as Record<string, string> // env
      );

      if (result.error) {
        return {
          success: false,
          error: result.error
        };
      }

      return {
        success: true,
        data: result
      };
    } catch (e: unknown) {
      const err = e as Error;
      return {
        success: false,
        error: `Audio Fidelity Audit failed: ${err.message}`
      };
    }
  }
}
