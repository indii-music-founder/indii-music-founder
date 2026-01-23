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
   * Executes the ITMSP packaging process using PythonBridge.
   * @param options The packaging options (releaseId, stagingPath)
   * @param pythonBridge Instance of PythonBridge from electron/utils/python-bridge
   * @returns Standardized result object
   */
  async execute(options: ItmspPackagingOptions, pythonBridge: any): Promise<ItmspPackagingResult> {
    // 1. Validation
    const validation = ItmspPackagingSchema.safeParse(options);
    if (!validation.success) {
      return {
        success: false,
        error: `Validation Error: ${validation.error.issues.map(i => i.message).join(', ')}`
      };
    }

    const { releaseId, stagingPath } = validation.data;

    // 2. Execute using PythonBridge
    // PythonBridge correctly resolves script paths for both dev and production
    try {
      const result = await pythonBridge.runScript(
        'distribution',
        'package_itmsp.py',
        [releaseId, stagingPath]
      );

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
