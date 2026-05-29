import { logger } from '@/utils/logger';

export interface A2AConfig {
  mode: 'loopback' | 'http';
  baseUrl: string;
}

export const MY_AGENT_ID = 'indii-conductor';

/**
 * Get the A2A transport configuration.
 * Resolution order:
 * 1. If VITE_A2A_MODE is explicitly set, use it
 * 2. If VITE_A2A_SIDECAR_URL is set and reachable, use 'http'
 * 3. Default to 'loopback' (in-process, zero external deps)
 */
export async function getA2AConfig(): Promise<A2AConfig> {
  const envVars = import.meta.env as Record<string, string | undefined>;
  const explicitMode = envVars.VITE_A2A_MODE as 'loopback' | 'http' | undefined;

  if (explicitMode) {
    const baseUrl = envVars.VITE_A2A_SIDECAR_URL || 'http://localhost:50080/a2a';
    logger.info(`[A2AConfig] Explicit mode: ${explicitMode}, baseUrl: ${baseUrl}`);
    return { mode: explicitMode, baseUrl };
  }

  // If HTTP sidecar URL is provided, check if it's reachable
  if (envVars.VITE_A2A_SIDECAR_URL) {
    const isReachable = await checkSidecarAvailable(envVars.VITE_A2A_SIDECAR_URL);
    if (isReachable) {
      logger.info(`[A2AConfig] Sidecar reachable at ${envVars.VITE_A2A_SIDECAR_URL}, using HTTP transport`);
      return { mode: 'http', baseUrl: envVars.VITE_A2A_SIDECAR_URL };
    }
  }

  // Default to loopback (always available, zero external deps).
  // baseUrl is unused in loopback mode; kept empty to avoid implying a live endpoint.
  logger.info('[A2AConfig] Using default loopback transport');
  return { mode: 'loopback', baseUrl: '' };
}

/**
 * Check if the HTTP sidecar is available with a short timeout.
 */
async function checkSidecarAvailable(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${baseUrl}/discovery`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Cache the config with a short TTL so a sidecar coming online/offline is
// eventually re-detected (the original "cache forever" never picked up changes).
let cachedConfig: A2AConfig | null = null;
let cachedAt = 0;
const CONFIG_TTL_MS = 60_000;

export async function resolveA2AConfig(): Promise<A2AConfig> {
  const now = Date.now();
  if (!cachedConfig || now - cachedAt > CONFIG_TTL_MS) {
    cachedConfig = await getA2AConfig();
    cachedAt = now;
  }
  return cachedConfig;
}

/**
 * Force the next resolveA2AConfig() to re-probe. Called by the circuit breaker
 * when it trips/resets so transport selection can adapt to sidecar availability.
 */
export function invalidateA2AConfig(): void {
  cachedConfig = null;
  cachedAt = 0;
}
