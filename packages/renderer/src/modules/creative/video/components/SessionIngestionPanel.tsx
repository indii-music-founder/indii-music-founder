import React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Film, Pause, Play, UploadCloud, X } from 'lucide-react';
import { VideoSessionSchema, type VideoSession } from '@indii/shared';
import {
    SessionVideoUploadService,
    type SessionUploadHandle,
    type SessionUploadProgress,
} from '@/services/video/SessionVideoUploadService';
import { db } from '@/services/firebase';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';

interface SessionIngestionPanelProps {
    organizationId?: string;
    projectId?: string | null;
    onOpenProxy: (session: VideoSession) => Promise<void> | void;
}

const storageKey = (uid: string, projectId: string) =>
    `indii:video-session:${uid}:${projectId}`;

const uploadFingerprint = (file: File) =>
    `${file.name}\0${file.size}\0${file.lastModified}\0${file.type}`;

async function idempotencyKey(
    uid: string,
    organizationId: string,
    projectId: string,
    file: File,
    attemptId?: string,
) {
    const bytes = new TextEncoder().encode(
        `${uid}\0${organizationId}\0${projectId}\0${uploadFingerprint(file)}${attemptId ? `\0${attemptId}` : ''}`,
    );
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `session-${Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')}`;
}

export const SessionIngestionPanel: React.FC<SessionIngestionPanelProps> = ({
    organizationId,
    projectId,
    onOpenProxy,
}) => {
    const toast = useToast();
    const [open, setOpen] = React.useState(false);
    const [session, setSession] = React.useState<VideoSession>();
    const [handle, setHandle] = React.useState<SessionUploadHandle>();
    const [progress, setProgress] = React.useState<SessionUploadProgress>();
    const [error, setError] = React.useState<string>();
    const [starting, setStarting] = React.useState(false);

    const ownerUid = useStore(state => state.user?.uid);
    const effectiveOrganizationId = organizationId || 'org-default';
    const canUpload = Boolean(ownerUid && projectId);
    const terminalSession = session?.status === 'failed' || session?.status === 'cancelled';

    React.useEffect(() => {
        setSession(undefined);
        setHandle(undefined);
        setProgress(undefined);
        setError(undefined);
    }, [ownerUid, projectId]);

    React.useEffect(() => {
        if (!ownerUid || !projectId || session?.sessionId) return undefined;
        const remembered = localStorage.getItem(storageKey(ownerUid, projectId));
        if (!remembered) return undefined;
        return onSnapshot(doc(db, 'videoSessions', remembered), snapshot => {
            const parsed = VideoSessionSchema.safeParse(snapshot.data());
            if (parsed.success) setSession(parsed.data);
        }, snapshotError => {
            setError(snapshotError.message);
        });
    }, [ownerUid, projectId, session?.sessionId]);

    React.useEffect(() => {
        if (!session?.sessionId) return undefined;
        return onSnapshot(doc(db, 'videoSessions', session.sessionId), snapshot => {
            const parsed = VideoSessionSchema.safeParse(snapshot.data());
            if (parsed.success) setSession(parsed.data);
        }, snapshotError => {
            setError(snapshotError.message);
        });
    }, [session?.sessionId]);

    const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !ownerUid || !projectId) return;
        setStarting(true);
        setError(undefined);
        try {
            const key = await idempotencyKey(
                ownerUid,
                effectiveOrganizationId,
                projectId,
                file,
                terminalSession ? crypto.randomUUID() : undefined,
            );
            const upload = await SessionVideoUploadService.start(file, {
                organizationId: effectiveOrganizationId,
                projectId,
                idempotencyKey: key,
            }, setProgress);
            setHandle(upload);
            setSession(upload.session);
            localStorage.setItem(storageKey(ownerUid, projectId), upload.session.sessionId);
            void upload.completion.catch(uploadError => {
                const message = uploadError instanceof Error ? uploadError.message : 'Session upload failed.';
                setError(message);
            });
        } catch (uploadError) {
            const message = uploadError instanceof Error ? uploadError.message : 'Session upload failed.';
            setError(message);
            toast.error(message);
        } finally {
            setStarting(false);
        }
    };

    const cancel = async () => {
        if (!handle) return;
        try {
            await handle.cancel();
            toast.info('Session upload cancelled. The immutable original, if already finalized, is preserved.');
        } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel the session.');
        }
    };

    const completed = session?.status === 'completed' && Boolean(session.proxyManifest);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(value => !value)}
                className="w-10 h-10 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all shadow-xl backdrop-blur-md"
                aria-label="Import a long recording session"
                aria-expanded={open}
                title="Import long recording"
            >
                <UploadCloud size={18} />
            </button>
            {open && (
                <section
                    aria-label="Long recording session"
                    className="absolute top-0 left-12 w-80 rounded-xl border border-purple-500/20 bg-gray-950/95 p-4 shadow-2xl backdrop-blur-xl text-xs"
                >
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                            <h2 className="font-bold text-white">Long recording</h2>
                            <p className="text-[10px] text-gray-400">Private resumable upload + edit proxy</p>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} aria-label="Close long recording panel">
                            <X size={15} className="text-gray-500 hover:text-white" />
                        </button>
                    </div>

                    {!canUpload && (
                        <p role="status" className="rounded bg-amber-950/70 p-2 text-amber-200">
                            Sign in and select a project before importing a session.
                        </p>
                    )}

                    {canUpload && !completed && (
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-purple-500/40 p-3 text-purple-200 hover:bg-purple-500/10">
                            <UploadCloud size={15} />
                            {starting
                                ? 'Authorizing…'
                                : terminalSession
                                    ? 'Choose file to retry'
                                    : session
                                        ? 'Select the same file to resume'
                                        : 'Choose phone recording'}
                            <input
                                type="file"
                                accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                                className="sr-only"
                                disabled={starting}
                                onChange={event => { void selectFile(event); }}
                            />
                        </label>
                    )}

                    {progress && (
                        <div className="mt-3 space-y-2" role="status" aria-live="polite">
                            <div className="flex justify-between text-gray-300">
                                <span className="capitalize">{progress.state}</span>
                                <span>{Math.round(progress.percent)}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded bg-gray-800">
                                <div
                                    className="h-full bg-purple-400 transition-all"
                                    style={{ width: `${Math.min(100, progress.percent)}%` }}
                                />
                            </div>
                            {handle && progress.state !== 'success' && (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => progress.state === 'paused' ? handle.resume() : handle.pause()}
                                        className="flex flex-1 items-center justify-center gap-1 rounded bg-gray-800 px-2 py-1.5 hover:bg-gray-700"
                                    >
                                        {progress.state === 'paused' ? <Play size={12} /> : <Pause size={12} />}
                                        {progress.state === 'paused' ? 'Resume' : 'Pause'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { void cancel(); }}
                                        className="rounded bg-red-950 px-2 py-1.5 text-red-200 hover:bg-red-900"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {session && (
                        <div className="mt-3 rounded bg-white/5 p-2 text-gray-300" role="status">
                            <span className="font-mono text-[10px]">{session.sessionId.slice(0, 12)}</span>
                            <span className="float-right capitalize">{session.status}</span>
                            {session.status === 'uploaded' || session.status === 'processing' ? (
                                <p className="clear-both pt-1 text-[10px] text-gray-500">
                                    The original is safe. Building the private proxy…
                                </p>
                            ) : null}
                        </div>
                    )}

                    {completed && session && (
                        <button
                            type="button"
                            onClick={() => { void onOpenProxy(session); }}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white hover:bg-emerald-500"
                        >
                            <Film size={14} />
                            Open edit proxy
                        </button>
                    )}

                    {error && <p role="alert" className="mt-3 rounded bg-red-950/70 p-2 text-red-200">{error}</p>}
                </section>
            )}
        </div>
    );
};
