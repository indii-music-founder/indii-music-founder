/**
 * Evolas Phase T1.4 — Context caching (docs/EVOLAS_BUILD_PLAN.md).
 *
 * PLAN CORRECTION (logged as ISSUE — see ledger): the build plan originally
 * targeted this file at `packages/renderer/src/services/persona/` using a
 * raw `@google/genai` client. That would violate this repo's own
 * backend-only AI architecture (docs/BACKEND_ONLY_API_DECLARATION.md) —
 * Gemini/Vertex access is Cloud-Functions-only, ADC-authenticated, never
 * client-side. This lives in `packages/firebase` instead, using the
 * existing `getVertexAIClient()` singleton (same ADC pattern as every other
 * backend AI call in this repo), never a client-facing key or endpoint.
 *
 * One cache per persona, never per user (cost control: the whole point is
 * that N users of the same persona share one cached prefix). The per-user
 * fader-compiled style block from PersonaPromptCompiler (T1.2) must be
 * assembled OUTSIDE this cache, in the per-request `contents`, never baked
 * into the cached `systemInstruction` — caching it per-user would defeat
 * the cost model and is exactly the mistake the build plan warns against.
 */

import { getVertexAIClient } from './vertexClient';
import { createHash } from 'node:crypto';

const DEFAULT_TTL = '3600s'; // 1 hour — matches Gemini's own default
const DEFAULT_CACHE_MODEL = 'gemini-3.6-flash';

interface PersonaCacheEntry {
    cacheName: string;
    contentHash: string;
    expireAtMs: number;
}

const personaCacheMap = new Map<string, PersonaCacheEntry>();

function hashContent(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function isExpired(entry: PersonaCacheEntry): boolean {
    return Date.now() >= entry.expireAtMs;
}

function parseTtlToMs(ttl: string): number {
    const match = /^([\d.]+)s$/.exec(ttl);
    if (!match) {
        throw new Error(`PersonaCacheManager: unsupported TTL format "${ttl}" — expected e.g. "3600s"`);
    }
    return Math.round(parseFloat(match[1]!) * 1000);
}

/**
 * Get (or create, or refresh if stale) the shared cache for one persona's
 * system instruction. Returns the cache resource name to pass as
 * `config.cachedContent` on the actual generation call.
 *
 * `systemInstructionText` must be the persona's ARCHETYPE/DOMAIN grounding
 * only — never a per-user fader-compiled style block. If the text changes
 * (e.g. archetype grounding is edited), the content hash mismatch triggers
 * a fresh cache rather than silently serving stale grounding forever.
 */
export async function getOrCreatePersonaCache(
    personaId: string,
    systemInstructionText: string,
    model: string = DEFAULT_CACHE_MODEL,
    ttl: string = DEFAULT_TTL
): Promise<string> {
    if (!personaId || typeof personaId !== 'string') {
        throw new Error('PersonaCacheManager: personaId is required');
    }
    if (!systemInstructionText || systemInstructionText.trim().length === 0) {
        throw new Error('PersonaCacheManager: systemInstructionText must not be empty');
    }

    const contentHash = hashContent(systemInstructionText);
    const existing = personaCacheMap.get(personaId);

    if (existing && existing.contentHash === contentHash && !isExpired(existing)) {
        return existing.cacheName;
    }

    // Stale (content changed) or expired — best-effort cleanup of the old
    // resource before creating a fresh one. Never let a delete failure
    // block creating the replacement.
    if (existing) {
        await deleteCacheResource(existing.cacheName);
    }

    const client = getVertexAIClient();
    const cached = await client.caches.create({
        model,
        config: {
            displayName: `persona-${personaId}`,
            systemInstruction: systemInstructionText,
            ttl,
        },
    });

    if (!cached.name) {
        throw new Error(`PersonaCacheManager: cache creation for persona "${personaId}" returned no resource name`);
    }

    personaCacheMap.set(personaId, {
        cacheName: cached.name,
        contentHash,
        expireAtMs: Date.now() + parseTtlToMs(ttl),
    });

    return cached.name;
}

async function deleteCacheResource(cacheName: string): Promise<void> {
    try {
        await getVertexAIClient().caches.delete({ name: cacheName });
    } catch (err) {
        // Best-effort — the resource will auto-expire via TTL regardless.
        console.warn(`[PersonaCacheManager] Failed to delete stale cache ${cacheName}:`, err);
    }
}

/**
 * Explicit manual invalidation — e.g. after an intentional persona-prompt
 * redesign that should take effect immediately rather than waiting for the
 * next content-hash mismatch or TTL expiry.
 */
export async function invalidatePersonaCache(personaId: string): Promise<void> {
    const existing = personaCacheMap.get(personaId);
    if (!existing) return;

    personaCacheMap.delete(personaId);
    await deleteCacheResource(existing.cacheName);
}

/** Test/ops utility — clears local tracking without calling the delete API. */
export function resetPersonaCacheTracking(): void {
    personaCacheMap.clear();
}
