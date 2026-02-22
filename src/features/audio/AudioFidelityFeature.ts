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

    // 2. Dynamic import Node modules (Electron-only, avoids Vite bundling)
    const { spawn } = await import('child_process');
    const path = await import('path');
    const scriptPath = path.resolve(process.cwd(), 'execution/audio/audio_fidelity_audit.py');

    // 3. Execution
    return new Promise((resolve) => {
      const child = spawn(pythonPath, [scriptPath, filePath, targetStandard]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        resolve({
          success: false,
          error: `Process Execution Error: ${err.message}`
        });
      });

      child.on('close', (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: `Script failed with code ${code}. Stderr: ${stderr.trim()}`
          });
          return;
        }

        try {
          // The script prints JSON to stdout
          const result = JSON.parse(stdout.trim());

          if (result.error) {
            resolve({
              success: false,
              error: result.error
            });
          } else {
            resolve({
              success: true,
              data: result
            });
          }
        } catch (e) {
          const err = e as Error;
          resolve({
            success: false,
            error: `Failed to parse script output: ${err.message}. Raw output: ${stdout}`
          });
        }
      });
    });
  }
}
