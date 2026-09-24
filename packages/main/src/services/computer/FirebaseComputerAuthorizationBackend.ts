import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ArtistOperatingProfileSchema } from '@indii/shared';
import type { ComputerAuthorizationBackend, StoredComputerApproval, VerifiedComputerIdentity } from './ComputerAuthorizationService';

type FirestoreValue = Record<string, unknown>;

function decode(value: FirestoreValue | undefined): unknown {
    if (!value) return undefined;
    if ('nullValue' in value) return null;
    for (const key of ['stringValue', 'booleanValue', 'doubleValue'] as const) if (key in value) return value[key];
    if ('integerValue' in value) return Number(value.integerValue);
    if ('timestampValue' in value) return Date.parse(String(value.timestampValue));
    if ('arrayValue' in value) return ((value.arrayValue as { values?: FirestoreValue[] }).values ?? []).map(decode);
    if ('mapValue' in value) return decodeFields((value.mapValue as { fields?: Record<string, FirestoreValue> }).fields ?? {});
    return undefined;
}

function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

export class FirebaseComputerAuthorizationBackend implements ComputerAuthorizationBackend {
    private readonly projectId: string;

    constructor(projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'indii-music-founder') {
        this.projectId = projectId;
    }

    async verifyIdentity(idToken: string): Promise<VerifiedComputerIdentity> {
        const name = 'computer-authorization';
        const app = getApps().some(candidate => candidate.name === name)
            ? getApp(name)
            : initializeApp({ projectId: this.projectId }, name);
        const decoded = await getAuth(app).verifyIdToken(idToken, true);
        return { uid: decoded.uid };
    }

    private async getDocument(path: string, idToken: string): Promise<Record<string, unknown> | null> {
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/databases/(default)/documents/${path}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Authorization policy lookup failed (${response.status}).`);
        const body = await response.json() as { fields?: Record<string, FirestoreValue> };
        return decodeFields(body.fields ?? {});
    }

    async hasComputerControlOptIn(uid: string, idToken: string): Promise<boolean> {
        const data = await this.getDocument(`users/${encodeURIComponent(uid)}/aop/profile`, idToken);
        if (!data) return false;
        // Firestore timestamps are not part of the policy decision and the shared schema
        // expects its optional updatedAt field as an ISO string.
        delete data.updatedAt;
        const profile = ArtistOperatingProfileSchema.safeParse(data);
        return profile.success && profile.data.permissions.autonomousComputerControl === true;
    }

    async getApproval(uid: string, approvalId: string, idToken: string): Promise<StoredComputerApproval | null> {
        const data = await this.getDocument(`users/${encodeURIComponent(uid)}/tool_approvals/${encodeURIComponent(approvalId)}`, idToken);
        if (!data) return null;
        if (typeof data.agentId !== 'string' || typeof data.toolName !== 'string' || typeof data.status !== 'string' || typeof data.createdAt !== 'number') return null;
        return {
            id: approvalId,
            userId: uid,
            agentId: data.agentId,
            toolName: data.toolName,
            args: data.args && typeof data.args === 'object' && !Array.isArray(data.args) ? data.args as Record<string, unknown> : {},
            status: data.status as StoredComputerApproval['status'],
            createdAtMs: data.createdAt,
        };
    }
}
