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

export const SessionIngestionPanel: React.FC<SessionIngestionPanelProps> = props => {
    const user = useStore(state => state.user);
    const projectOrganizationId = useStore(state =>
        state.projects.find(project => project.id === props.projectId)?.orgId,
    );
    const organizationId = projectOrganizationId || props.organizationId;
    return <ScopedSessionIngestionPanel
        key={JSON.stringify([user?.uid, user?.isAnonymous, organizationId, props.projectId])}
        {...props}
        organizationId={organizationId}
    />;
};
const ScopedSessionIngestionPanel: React.FC<SessionIngestionPanelProps> = ({
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
    const [opening, setOpening] = React.useState(false);
    const alive = React.useRef(true); const activeHandle = React.useRef<SessionUploadHandle>();
    const startInFlight = React.useRef(false); const attempt = React.useRef(0);
    const isAnonymous = useStore(state => state.user?.isAnonymous);

    const ownerUid = useStore(state => state.user?.uid);
    const effectiveOrganizationId = organizationId || 'org-default';
    const canUpload = Boolean(ownerUid && !isAnonymous && projectId);
    const terminalSession = session?.status === 'failed' || session?.status === 'cancelled';

    React.useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            if (activeHandle.current?.suspend) activeHandle.current.suspend(); else activeHandle.current?.pause();
        };
    }, []);
    const acceptSession = React.useCallback((candidate: unknown) => {
        const parsed = VideoSessionSchema.safeParse(candidate);
        if (alive.current && parsed.success && parsed.data.ownerUid === ownerUid && parsed.data.projectId === projectId
            && parsed.data.organizationId === effectiveOrganizationId) setSession(parsed.data);
    }, [ownerUid, projectId, effectiveOrganizationId]);

    React.useEffect(() => {
        if (!canUpload || !ownerUid || !projectId || session?.sessionId) return undefined;
        let remembered: string | null;
        try { remembered = localStorage.getItem(storageKey(ownerUid, projectId)); }
        catch { setError('This browser cannot remember uploads. Keep this page open.'); return undefined; }
        if (!remembered) return undefined;
        return onSnapshot(doc(db, 'videoSessions', remembered), snapshot => {
            acceptSession(snapshot.data());
        }, snapshotError => {
            setError(snapshotError.message);
        });
    }, [ownerUid, projectId, canUpload, session?.sessionId, acceptSession]);

    React.useEffect(() => {
        if (!session?.sessionId) return undefined;
        return onSnapshot(doc(db, 'videoSessions', session.sessionId), snapshot => {
            acceptSession(snapshot.data());
        }, snapshotError => {
            setError(snapshotError.message);
        });
    }, [session?.sessionId, acceptSession]);

    const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !canUpload || !ownerUid || !projectId || startInFlight.current) return;
        startInFlight.current = true; const currentAttempt = ++attempt.current;
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
            if (!alive.current) return;
            activeHandle.current?.suspend?.();
            const upload = await SessionVideoUploadService.start(file, {
                organizationId: effectiveOrganizationId,
                projectId,
                idempotencyKey: key,
            }, next => { if (alive.current && attempt.current === currentAttempt) setProgress(next); });
            void upload.completion.catch(uploadError => {
                if (alive.current && attempt.current === currentAttempt) setError(uploadError instanceof Error ? uploadError.message : 'Session upload failed.');
            });
            if (!alive.current) { if (upload.suspend) upload.suspend(); else upload.pause(); return; }
            activeHandle.current = upload; setHandle(upload); setSession(upload.session);
            try { localStorage.setItem(storageKey(ownerUid, projectId), upload.session.sessionId); }
            catch { setError('Upload started, but this browser cannot remember it. Keep this page open.'); }
        } catch (uploadError) {
            if (!alive.current) return;
            const message = uploadError instanceof Error ? uploadError.message : 'Session upload failed.';
            setError(message);
            toast.error(message);
        } finally {
            startInFlight.current = false;
            if (alive.current) setStarting(false);
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
                className="w-10 h-10 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all shadow-xl backdrop-blur-md"
                aria-label="Import a long recording session"
                aria-expanded={open}
                title="Import long recording"
            >
                <UploadCloud size={18} />
            </button>
            {open && (
                <section
                    aria-label="Long recording session"
                    className="absolute top-12 left-0 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-cyan-500/20 bg-gray-950/95 p-4 shadow-2xl backdrop-blur-xl text-xs"
                >
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                            <h2 className="font-bold text-white">Long recording</h2>
                            <p className="text-[10px] text-gray-400">iPhone video · up to 20 GiB · original preserved</p>
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
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-500/40 p-3 text-cyan-200 hover:bg-cyan-500/10">
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
                                accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
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
                                    className="h-full bg-cyan-400 transition-all"
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
                            disabled={opening}
                            onClick={async () => {
                                setOpening(true);
                                try { await onOpenProxy(session); }
                                catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Could not open the recording.'); }
                                finally { if (alive.current) setOpening(false); }
                            }}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white hover:bg-emerald-500"
                        >
                            <Film size={14} />
                            {opening ? 'Opening…' : 'Open edit proxy'}
                        </button>
                    )}

                    {completed && <button type="button" className="mt-2 w-full text-cyan-200 underline" onClick={() => {
                        if (ownerUid && projectId) { try { localStorage.removeItem(storageKey(ownerUid, projectId)); } catch { /* Original remains on server. */ } }
                        setSession(undefined); setHandle(undefined); setProgress(undefined); setError(undefined);
                    }}>Import another recording</button>}
                    {error && <p role="alert" className="mt-3 rounded bg-red-950/70 p-2 text-red-200">{error}</p>}
                </section>
            )}
        </div>
    );
};
