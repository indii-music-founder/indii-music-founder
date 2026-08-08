import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

export const PROPRIETARY_RELEASES_COLLECTION = 'proprietaryIngestionReleases';

export interface ReleaseCatalogRecord {
    id: string;
    data: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function firstString(...values: unknown[]): string | undefined {
    return values.find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined;
}

export function getReleaseTitle(data: Record<string, unknown>): string | undefined {
    const metadata = asRecord(data.metadata);
    return firstString(metadata.trackTitle, data.trackTitle, data.title);
}

export function getReleaseIsrc(data: Record<string, unknown>): string | undefined {
    const metadata = asRecord(data.metadata);
    const assets = asRecord(data.assets);
    return firstString(metadata.isrc, assets.isrc, data.isrc);
}

export function getReleaseDate(data: Record<string, unknown>): Date | undefined {
    const metadata = asRecord(data.metadata);
    const value = data.releaseDate ?? metadata.releaseDate;
    if (value == null) return undefined;

    if (typeof (value as { toDate?: unknown }).toDate === 'function') {
        const date = (value as { toDate: () => Date }).toDate();
        return Number.isFinite(date.getTime()) ? date : undefined;
    }
    if (typeof (value as { seconds?: unknown }).seconds === 'number') {
        const date = new Date((value as { seconds: number }).seconds * 1_000);
        return Number.isFinite(date.getTime()) ? date : undefined;
    }
    if (value instanceof Date) {
        const date = new Date(value.getTime());
        return Number.isFinite(date.getTime()) ? date : undefined;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date : undefined;
    }
    return undefined;
}

export function getReleaseWriters(data: Record<string, unknown>): string[] {
    const metadata = asRecord(data.metadata);
    const value = data.writers ?? metadata.writers;
    if (!Array.isArray(value)) return [];
    return value.flatMap(writer => {
        if (typeof writer === 'string' && writer.trim()) return [writer.trim()];
        const name = firstString(asRecord(writer).name, asRecord(writer).writerName);
        return name ? [name] : [];
    });
}

export class ReleaseCatalogService {
    async listCurrentUserReleases(maxResults = 250): Promise<ReleaseCatalogRecord[]> {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            throw new Error('Sign in to query the release catalog.');
        }

        const snapshot = await getDocs(query(
            collection(db, PROPRIETARY_RELEASES_COLLECTION),
            where('userId', '==', uid),
            limit(maxResults),
        ));

        return snapshot.docs.map(releaseDoc => ({
            id: releaseDoc.id,
            data: releaseDoc.data() as Record<string, unknown>,
        }));
    }
}

export const releaseCatalogService = new ReleaseCatalogService();
