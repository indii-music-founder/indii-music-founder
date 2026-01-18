import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';

// Schema for input validation
export const ItmspPackagingSchema = z.object({
  releaseId: z.string().min(1, "Release ID is required").regex(/^[a-zA-Z0-9_-]+$/, "Release ID must be alphanumeric (dashes/underscores allowed)"),
  stagingPath: z.string().min(1, "Staging path is required"),
  // Optional: pythonPath for environment configuration
  pythonPath: z.string().optional().default('python3'),
});

export type ItmspPackagingOptions = z.infer<typeof ItmspPackagingSchema>;

export interface ItmspPackagingResult {
  success: boolean;
  data?: {
    status: string;
    release_id: string;
    bundle_path: string;
    details: string;
    delivery_ready: boolean;
  };
  error?: string;
}

/**
 * Feature: ITMSP Packaging
 * Wraps the execution/distribution/package_itmsp.py script.
 * Ensures strict input validation and standardized output.
 */
export class ItmspPackagingFeature {

  /**
   * Executes the ITMSP packaging process.
   * @param options The packaging options (releaseId, stagingPath)
   * @returns Standardized result object
   */
  async execute(options: ItmspPackagingOptions): Promise<ItmspPackagingResult> {
    // 1. Validation
    const validation = ItmspPackagingSchema.safeParse(options);
    if (!validation.success) {
      return {
        success: false,
        error: `Validation Error: ${validation.error.issues.map(i => i.message).join(', ')}`
      };
    }

    const { releaseId, stagingPath, pythonPath } = validation.data;

    // 2. Resolve script path
    // Assuming the code runs from repo root or we can locate execution/ folder
    const scriptPath = path.resolve(process.cwd(), 'execution/distribution/package_itmsp.py');

    // 3. Execution
    return new Promise((resolve) => {
      const child = spawn(pythonPath, [scriptPath, releaseId, stagingPath]);

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
          // Attempt to parse stderr or fallback
          resolve({
            success: false,
            error: `Script failed with code ${code}. Stderr: ${stderr.trim()}`
          });
          return;
        }

        try {
          // The script prints JSON to stdout
          const result = JSON.parse(stdout.trim());

          if (result.status === 'FAIL' || result.error) {
            resolve({
              success: false,
              error: result.error || 'Unknown script error'
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
