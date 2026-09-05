/**
 * AssetVersionService.ts
 *
 * Append-only asset version graph (Workstream H1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §13).
 *
 * Every derived asset (generation, edit, fusion, canvas export, typography,
 * mockup, export bundle, upload) is recorded as a NEW immutable version node.
 * Nothing is ever mutated or deleted; "promote"/revert creates a new head node
 * that copies the target version, so full lineage is always reconstructable.
 *
 * Persistence mirrors LikenessService exactly:
 * Firestore `users/{uid}/assetVersions/{assetId}/versions/{versionId}`.
 */

import { auth, db } from '@/services/firebase';
import { collection, doc, setDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export type VersionSource =
    | 'generation'
    | 'edit'
    | 'fusion'
    | 'canvas-export'
    | 'typography'
    | 'mockup'
    | 'export-bundle'
    | 'upload';

export interface AssetVersionProvenance {
    provider?: string;
    model?: string;
    prompt?: string;
    note?: string;
}

/** Last compliance scan result (Workstream D), if one ran against this version. */
export interface AssetVersionCompliance {
    passed: boolean;
    score: number;
    overrideReason?: string;
}

export interface AssetVersion {
    versionId: string;
    assetId: string;
    parentVersionId: string | null;
    url: string;
    createdAt: number;
    source: VersionSource;
    provenance?: AssetVersionProvenance;
    compliance?: AssetVersionCompliance;
    tags: string[];
}

export interface RecordVersionInput {
    assetId: string;
    parentVersionId: string | null;
    url: string;
    source: VersionSource;
    provenance?: AssetVersionProvenance;
    compliance?: AssetVersionCompliance;
    tags?: string[];
}

const SOURCES: readonly VersionSource[] = [
    'generation', 'edit', 'fusion', 'canvas-export',
    'typography', 'mockup', 'export-bundle', 'upload'
];

class AssetVersionServiceImpl {
    private getUid(): string | null {
        return auth.currentUser?.uid ?? null;
    }

    private getVersionsRef(assetId: string) {
        const uid = this.getUid();
        if (!uid) throw new Error('User not authenticated');
        if (!assetId) throw new Error('assetId is required');
        return collection(db, 'users', uid, 'assetVersions', assetId, 'versions');
    }

    private validate(input: RecordVersionInput): void {
        if (!SOURCES.includes(input.source)) {
            throw new Error(`Invalid version source "${String(input.source)}". Valid: ${SOURCES.join(', ')}`);
        }
        if (!input.url) throw new Error('url is required');
    }

    /**
     * Append a new immutable version node. Never mutates existing nodes.
     */
    async recordVersion(input: RecordVersionInput): Promise<AssetVersion> {
        this.validate(input);
        const version: AssetVersion = {
            versionId: `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            assetId: input.assetId,
            parentVersionId: input.parentVersionId ?? null,
            url: input.url,
            createdAt: Date.now(),
            source: input.source,
            provenance: input.provenance,
            compliance: input.compliance,
            tags: input.tags ?? []
        };
        await setDoc(doc(this.getVersionsRef(input.assetId), version.versionId), { ...version });
        logger.info('[AssetVersionService]', `Recorded ${version.source} version ${version.versionId} for asset ${input.assetId}${input.parentVersionId ? ` (parent ${input.parentVersionId})` : ' (root)'}`);
        return version;
    }

    /**
     * Full version tree for an asset, oldest-first. Orphaned parents (nodes
     * whose parentVersionId no longer resolves) are allowed and returned as-is.
     */
    async getVersionTree(assetId: string): Promise<AssetVersion[]> {
        const snap = await getDocs(query(this.getVersionsRef(assetId), orderBy('createdAt', 'asc')));
        return snap.docs.map(d => ({ ...(d.data() as AssetVersion), versionId: d.id }));
    }

    /**
     * Promote (revert-to) an existing version: appends a NEW head node that
     * copies the target's content, with parentVersionId pointing at the target.
     * The target node itself is never touched — the graph stays append-only.
     */
    async promoteVersion(assetId: string, versionId: string): Promise<AssetVersion> {
        const tree = await this.getVersionTree(assetId);
        const target = tree.find(v => v.versionId === versionId);
        if (!target) {
            throw new Error(`Version ${versionId} not found for asset ${assetId}`);
        }
        return this.recordVersion({
            assetId,
            parentVersionId: target.versionId,
            url: target.url,
            source: target.source,
            provenance: target.provenance
                ? { ...target.provenance, note: `Promoted from ${target.versionId}` }
                : { note: `Promoted from ${target.versionId}` },
            compliance: target.compliance,
            tags: [...target.tags]
        });
    }
}

export const AssetVersionService = new AssetVersionServiceImpl();
