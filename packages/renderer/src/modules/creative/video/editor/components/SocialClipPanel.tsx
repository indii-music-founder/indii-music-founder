import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { ProjectService } from '@/services/ProjectService';
import { projectToMetadata } from '@/services/dashboard/projectTypeUtils';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { loadVideoProject, saveVideoProject } from '../../services/VideoProjectPersistenceService';
import { createSocialClipProject, type SocialFormat } from '../../services/socialClipProject';
import { CREATIVE_JOURNEY_LIMITS } from '../../../creativeJourney';

export function SocialClipPanel({ flushSave }: { flushSave: () => Promise<void> }) {
    const project = useVideoEditorStore(state => state.project);
    const scope = useStore(state => JSON.stringify([state.user?.uid, state.currentProjectId, state.currentOrganizationId]));
    const scopeRef = useRef(scope);
    const inFlight = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [open, setOpen] = useState(false);
    const [start, setStart] = useState('0');
    const [end, setEnd] = useState(String(CREATIVE_JOURNEY_LIMITS.socialClipDefaultSeconds));
    const [format, setFormat] = useState<SocialFormat>('9:16');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [created, setCreated] = useState<string>();

    useEffect(() => {
        scopeRef.current = scope;
        setCreated(undefined);
        setMessage('');
        setOpen(false);
        setBusy(false);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        return () => {
            scopeRef.current = '';
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, [scope]);

    const create = async () => {
        if (inFlight.current) return;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        inFlight.current = true;
        setBusy(true);
        setMessage('Initializing social copy...');
        setCreated(undefined);
        let newId: string | undefined;
        const active = useStore.getState();
        const stillActive = () =>
            !controller.signal.aborted &&
            scopeRef.current === scope &&
            JSON.stringify([
                useStore.getState().user?.uid,
                useStore.getState().currentProjectId,
                useStore.getState().currentOrganizationId,
            ]) === scope;

        try {
            if (!active.user || active.user.isAnonymous || active.currentProjectId !== project.id || !active.currentOrganizationId) {
                throw new Error('Sign in and open the source project before making a social copy.');
            }
            if (!start.trim() || !end.trim()) {
                throw new Error('Enter start and end times in seconds.');
            }
            setMessage('Creating timeline slice...');
            const copy = createSocialClipProject(
                project,
                Math.round(Number(start) * project.fps),
                Math.round(Number(end) * project.fps),
                crypto.randomUUID(),
                format
            );
            if (controller.signal.aborted) throw new Error('Cancelled.');
            await flushSave();
            if (controller.signal.aborted) throw new Error('Stop requested.');
            if (!stillActive()) return;

            setMessage('Provisioning project container...');
            const destination = await ProjectService.createProject(copy.name, 'creative', active.currentOrganizationId);
            newId = destination.id;
            if (controller.signal.aborted) throw new Error('Stop requested.');
            if (!stillActive()) return;
            copy.id = destination.id;

            setMessage('Verifying destination timeline...');
            const loaded = await loadVideoProject(destination.id, active.user.uid);
            if (controller.signal.aborted) throw new Error('Stop requested.');
            if (!stillActive()) return;
            if (loaded.status !== 'absent') {
                throw new Error('The new timeline could not be confirmed empty.');
            }

            setMessage('Saving social timeline...');
            const saved = await saveVideoProject(loaded.token, copy, active.user.uid, active.currentOrganizationId);
            if (!saved.success) {
                throw new Error(saved.reason || 'Could not save the social timeline.');
            }
            if (controller.signal.aborted) throw new Error('Stopped after saving.');
            if (!stillActive()) return;

            useStore.getState().addProject(projectToMetadata(destination));
            setCreated(destination.id);
            setMessage('Social copy saved. Open it to edit titles, framing, and cuts, then render and download.');
        } catch (error) {
            if (controller.signal.aborted && scopeRef.current === scope) {
                setMessage(`Social clip creation stopped.${newId ? ' A destination project was created; its timeline may have been saved. Check your projects before retrying.' : ''}`);
            } else if (stillActive() || scopeRef.current === scope) {
                setMessage(
                    `${error instanceof Error ? error.message : 'Could not make the copy.'}${
                        newId ? ' A new project was created, but its timeline may be incomplete. Your source is unchanged.' : ''
                    }`
                );
            }
        } finally {
            inFlight.current = false;
            if (scopeRef.current === scope) setBusy(false);
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    };

    return (
        <section className="border-b border-white/10 px-4 py-2 text-xs" aria-label="Social clip">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                    if (!open) {
                        const seconds = useVideoEditorStore.getState().currentTime / project.fps;
                        setStart(seconds.toFixed(2));
                        setEnd(Math.min(project.durationInFrames / project.fps, seconds + CREATIVE_JOURNEY_LIMITS.socialClipDefaultSeconds).toFixed(2));
                    }
                    setOpen(value => !value);
                }}
                className="rounded border border-white/20 px-3 py-2"
            >
                Social clip — make a separate copy
            </button>
            {open && (
                <div className="mt-2 flex flex-wrap items-end gap-3">
                    <label>
                        Start (seconds)
                        <input
                            className="block w-28 rounded bg-gray-900 p-2"
                            type="number"
                            min="0"
                            step="0.01"
                            value={start}
                            onChange={event => setStart(event.target.value)}
                        />
                    </label>
                    <label>
                        End (seconds)
                        <input
                            className="block w-28 rounded bg-gray-900 p-2"
                            type="number"
                            min="0"
                            step="0.01"
                            value={end}
                            onChange={event => setEnd(event.target.value)}
                        />
                    </label>
                    <label>
                        Format
                        <select
                            className="block rounded bg-gray-900 p-2"
                            value={format}
                            onChange={event => setFormat(event.target.value as SocialFormat)}
                        >
                            <option value="9:16">Reels / Shorts · 9:16</option>
                            <option value="4:5">Feed · 4:5</option>
                            <option value="original">Original framing</option>
                        </select>
                    </label>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => { void create(); }}
                        className="rounded bg-emerald-700 px-3 py-2 disabled:opacity-50"
                    >
                        {busy ? 'Saving…' : 'Save social copy'}
                    </button>
                    {busy && (
                        <button
                            type="button"
                            onClick={() => {
                                abortControllerRef.current?.abort();
                                setMessage('Stop requested. Waiting for the current save to finish; a destination project may already exist.');
                            }}
                            className="rounded border border-red-500/40 px-3 py-2 text-red-400 hover:bg-red-500/10"
                        >
                            Cancel
                        </button>
                    )}
                    <p className="w-full text-gray-400">
                        Use raw recordings or a finished video. Portrait formats fit the entire picture; adjust framing in the copy. Render animated or approved synced sections first to preserve their effects.
                    </p>
                    {message && <p role="status" className="w-full">{message}</p>}
                    {created && (
                        <button
                            type="button"
                            data-testid="open-social-copy-btn"
                            className="underline text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                            onClick={() => useStore.getState().setProject(created)}
                        >
                            Open the copy
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
