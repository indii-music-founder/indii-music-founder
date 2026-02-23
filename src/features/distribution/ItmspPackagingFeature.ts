import { z } from 'zod';

// Schema for input validation
export const ItmspPackagingSchema = z.object({
  releaseId: z.string().min(1, "Release ID is required").regex(/^[a-zA-Z0-9_-]+$/, "Release ID must be alphanumeric (dashes/underscores allowed)"),
  stagingPath: z.string().min(1, "Staging path is required"),
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
 *
 * NOTE: This feature must be executed from the Electron main process,
 * as it requires PythonBridge which uses Electron's app.isPackaged and process.resourcesPath
 * for correct path resolution in production builds.
 */
export class ItmspPackagingFeature {

  /**
   * Executes the ITMSP packaging process using PythonBridge or AgentSupervisor.
   * @param options The packaging options (releaseId, stagingPath)
   * @param runner Instance of PythonBridge or AgentSupervisor from electron/utils
   * @returns Standardized result object
   */
  async execute(options: ItmspPackagingOptions, runner: any): Promise<ItmspPackagingResult> {
    // 1. Validation
    const validation = ItmspPackagingSchema.safeParse(options);
    if (!validation.success) {
      return {
        success: false,
        error: `Validation Error: ${validation.error.issues.map(i => i.message).join(', ')}`
      };
    }

    const { releaseId, stagingPath } = validation.data;

    // 2. Execute using the provided runner
    try {
      // AgentSupervisor.runScript will throw if status === 'error' or parsing fails.
      // It returns output.data for strict schema scripts, or raw JSON for legacy.
      const result = await runner.runScript(
        'distribution',
        'package_itmsp.py',
        [releaseId, stagingPath]
      );

      // Handle both legacy format (status: FAIL) and supervisor-validated format
      if (result.status === 'FAIL' || result.error) {
        return {
          success: false,
          error: result.error || 'Unknown script error'
        };
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
