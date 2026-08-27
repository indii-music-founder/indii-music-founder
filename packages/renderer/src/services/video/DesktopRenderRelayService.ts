/**
 * Desktop render relay — the signed-in desktop Studio executes render jobs
 * queued from any surface (web included). Polls the user's videoRenderJobs,
 * claims queued jobs, renders locally, uploads the artifact to Storage, and
 * reports completion through the claim/complete callables.
 *
 * Every I/O boundary is injectable so the full lifecycle is unit-testable.
 */

import { useEffect } from 'react';

import type { IndiiVideoProject } from '@indii/shared';

import { auth, db, functions, storage } from '@/services/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

import { renderVideoProjectLocally } from './LocalVideoProjectRenderer';

export interface RelayJobSnapshot {
    jobId: string;
    projectId: string;
    outputName?: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
}

export interface DesktopRenderRelayDependencies {
    listQueuedJobs?: () => Promise<RelayJobSnapshot[]>;
    claim?: (jobId: string) => Promise<unknown>;
    complete?: (jobId: string, artifactUrl: string) => Promise<unknown>;
    fail?: (jobId: string, error: string) => Promise<unknown>;
    loadProject?: (projectId: string) => Promise<IndiiVideoProject>;
    render?: (project: IndiiVideoProject, outputName?: string) => Promise<string>;
    readArtifact?: (localPath: string) => Promise<string>;
    upload?: (dataUrl: string, jobId: string, outputName: string) => Promise<string>;
    hasDesktopApi?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
}

export const RELAY_POLL_MS = 60_000;

const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1];
    if (!base64) throw new Error('Artifact read returned no data.');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

const defaults = (): Required<DesktopRenderRelayDependencies> => ({
    listQueuedJobs: async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return [];
        const snapshot = await getDocs(query(
            collection(db, 'users', uid, 'videoRenderJobs'),
            where('status', '==', 'queued'),
        ));
        return snapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            return {
                jobId: String(data.jobId ?? docSnapshot.id),
                projectId: String(data.projectId ?? ''),
                ...(typeof data.outputName === 'string' ? { outputName: data.outputName } : {}),
                status: 'queued' as const,
            };
        });
    },
    claim: async jobId => {
        const claim = httpsCallable<{ jobId: string }, { claimed: true }>(functions, 'claimVideoRenderJob');
        await claim({ jobId });
    },
    complete: async (jobId, artifactUrl) => {
        const complete = httpsCallable<{ jobId: string; artifactUrl: string }, { completed: true }>(functions, 'completeVideoRenderJob');
        await complete({ jobId, artifactUrl });
    },
    fail: async (jobId, error) => {
        const complete = httpsCallable<{ jobId: string; error: string }, { completed: true }>(functions, 'completeVideoRenderJob');
        await complete({ jobId, error });
    },
    loadProject: async projectId => {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Relay requires a signed-in account.');
        const projectSnapshot = await getDoc(doc(db, 'users', uid, 'videoProjects', projectId));
        const data = projectSnapshot.data() as { project?: IndiiVideoProject } | undefined;
        if (!projectSnapshot.exists || !data?.project) {
            throw new Error(`Project ${projectId} not found for the relay.`);
        }
        return data.project;
    },
    render: async (project, outputName) => {
        const receipt = await renderVideoProjectLocally(project, { outputName });
        return receipt.asset.url.replace(/^file:\/\//, '');
    },
    readArtifact: async localPath => {
        const readArtifact = window.electronAPI?.video?.readArtifact;
        if (!readArtifact) throw new Error('Desktop artifact read is unavailable.');
        return readArtifact(localPath);
    },
    upload: async (dataUrl, jobId, outputName) => {
        const uid = auth.currentUser?.uid ?? 'unknown';
        const objectPath = `video-render-jobs/${uid}/${jobId}-${outputName}`;
        await uploadBytes(ref(storage, objectPath), dataUrlToBytes(dataUrl), { contentType: 'video/mp4' });
        return getDownloadURL(ref(storage, objectPath));
    },
    hasDesktopApi: () => typeof window !== 'undefined' && Boolean(window.electronAPI?.video?.render),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
});

/**
 * One poll iteration: claim → load project → render → read artifact →
 * upload → complete. Returns the completed artifact URL, or null when
 * nothing was queued or the attempt failed (the job then carries its error).
 */
export async function processNextRelayJob(dependencies: DesktopRenderRelayDependencies = {}): Promise<string | null> {
    const deps = { ...defaults(), ...dependencies };
    if (!deps.hasDesktopApi()) return null;
    const jobs = await deps.listQueuedJobs();
    if (jobs.length === 0) return null;

    const job = jobs[0]!;
    try {
        await deps.claim(job.jobId);

        const relayProject = await deps.loadProject(job.projectId);
        const localPath = await deps.render(relayProject, job.outputName ?? `${job.jobId}.mp4`);
        const dataUrl = await deps.readArtifact(localPath);
        const outputName = `${job.jobId}.mp4`;
        const url = await deps.upload(dataUrl, job.jobId, outputName);
        await deps.complete(job.jobId, url);
        return url;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await deps.fail(job.jobId, message).catch(() => undefined);
        return null;
    }
}

/** Starts the background relay poller; returns its stop handle. */
export function startDesktopRenderRelay(dependencies: DesktopRenderRelayDependencies = {}): () => void {
    let stopped = false;
    const deps = { ...defaults(), ...dependencies };
    const tick = async () => {
        if (stopped) return;
        try {
            await processNextRelayJob(deps);
        } catch (error) {
            console.warn('[DesktopRenderRelay] Poll failed:', error);
        }
        if (!stopped) setTimeout(tick, RELAY_POLL_MS);
    };
    // First poll after the editor hydrates; afterwards on the interval.
    setTimeout(tick, 10_000);
    return () => { stopped = true; };
}

/**
 * Editor lifecycle hook: desktop only. Starts the relay on mount and stops
 * it on unmount, so the desktop executes queued jobs while the studio runs.
 */
export function useDesktopRenderRelay(): void {
    useEffect(() => {
        if (typeof window === 'undefined' || !window.electronAPI?.video?.render) return;
        return startDesktopRenderRelay();
    }, []);
}
