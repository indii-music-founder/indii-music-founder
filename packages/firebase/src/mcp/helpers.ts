import { createHash, randomUUID } from 'node:crypto';

import { McpContext, McpOperationResult, McpOperationStatus, McpToolResponse } from './types.js';

/**
 * Compares uids only — it performs NO resource lookup. `targetUserId` must
 * come from a trusted source (typically `context.user.uid` itself or a
 * server-derived value). NEVER feed it a model/args-derived target: the old
 * `rawArgs.userId || ... || context.user.uid` pattern makes this check
 * decorative. For resource-level authorization use `verifyReleaseOwnership`.
 */
export function verifyOwnership(context: McpContext, targetUserId: string) {
    if (!context?.user) throw new Error('Unauthorized: Missing user context');
    if (context.user.uid !== targetUserId && context.user.admin !== true) {
        throw new Error(`Forbidden: User ${context.user.uid} is not authorized to act on behalf of ${targetUserId}`);
    }
}

interface OwnershipDocSnapshot {
    exists: boolean;
    data(): Record<string, unknown> | undefined;
}
interface OwnershipDocRef {
    get(): Promise<OwnershipDocSnapshot>;
    collection(name: string): OwnershipCollectionRef;
}
interface OwnershipCollectionRef {
    doc(id: string): OwnershipDocRef;
}
/** Minimal structural view of a Firestore instance — keeps helpers decoupled from firebase-admin types. */
export interface OwnershipFirestore {
    collection(name: string): OwnershipCollectionRef;
}

/**
 * Resource-level authorization: verifies that `releaseId` belongs to the
 * authenticated caller `uid`. Mirrors AssetResolutionAuditService.findRelease:
 * checks `users/{uid}/releases/{releaseId}` first, then top-level
 * `releases/{releaseId}` requiring its `userId ?? ownerUid` to equal `uid`.
 * Throws a single Forbidden message for both not-found and not-owned so
 * existence of other users' releases is never leaked.
 */
export async function verifyReleaseOwnership(firestore: OwnershipFirestore, uid: string, releaseId: string): Promise<void> {
    if (typeof releaseId !== 'string' || !releaseId.trim() || releaseId.length > 200 || releaseId.includes('/')) {
        throw new TypeError('releaseId must be a non-empty string no longer than 200 characters without "/".');
    }
    const id = releaseId.trim();
    const owned = await firestore.collection('users').doc(uid).collection('releases').doc(id).get();
    if (owned.exists) return;
    const topLevel = await firestore.collection('releases').doc(id).get();
    if (topLevel.exists) {
        const data = topLevel.data() ?? {};
        if ((data.userId ?? data.ownerUid) === uid) return;
    }
    throw new Error('Forbidden: release not found or not owned by caller');
}

export function requireString(args: Record<string, unknown>, key: string, maxLength = 256): string {
    const value = args[key];
    if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
        throw new TypeError(`${key} must be a non-empty string no longer than ${maxLength} characters.`);
    }
    return value.trim();
}

export function optionalIdempotencyKey(args: Record<string, unknown>): string | undefined {
    const value = args.idempotencyKey;
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
        throw new TypeError('idempotencyKey must contain 8-128 safe identifier characters.');
    }
    return value;
}

export function operationResult<T extends Record<string, unknown>>(input: {
    tool: string;
    actorUid: string;
    status: McpOperationStatus;
    resourceType: string;
    resourceId: string;
    data?: T;
    idempotencyKey?: string;
    approvalRequired?: boolean;
    evidence?: McpOperationResult<T>['evidence'];
    warnings?: string[];
}): McpOperationResult<T> {
    const operationId = input.idempotencyKey
        ? `mcp_${createHash('sha256').update(`${input.actorUid}\0${input.tool}\0${input.idempotencyKey}`, 'utf8').digest('hex').slice(0, 48)}`
        : randomUUID();
    return {
        schemaVersion: 'mcp-operation-result.v1',
        tool: input.tool,
        operationId,
        status: input.status,
        actorUid: input.actorUid,
        resource: { type: input.resourceType, id: input.resourceId, ownerUid: input.actorUid },
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        approval: { required: input.approvalRequired ?? false, state: input.approvalRequired ? 'pending' : 'not_required' },
        evidence: input.evidence ?? [],
        warnings: input.warnings ?? [],
        ...(input.data ? { data: input.data } : {}),
    };
}

export function failedOperationResult(input: {
    tool: string;
    actorUid: string;
    resourceType: string;
    resourceId: string;
    code: string;
    message: string;
    retryable: boolean;
    warnings?: string[];
}): McpOperationResult {
    return {
        ...operationResult({
            tool: input.tool,
            actorUid: input.actorUid,
            status: 'failed',
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            warnings: input.warnings,
        }),
        error: { code: input.code, message: input.message, retryable: input.retryable },
    };
}

export function toolResponse<T extends Record<string, unknown>>(result: McpOperationResult<T>): McpToolResponse {
    return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
        // MCP consumers use this flag to distinguish a failed operation from a
        // successful tool invocation that merely returned diagnostic text.
        isError: result.status === 'failed' || undefined,
    };
}
