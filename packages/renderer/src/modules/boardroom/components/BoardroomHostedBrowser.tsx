import { useEffect, useRef, useState } from 'react';
import { auth } from '@/services/firebase';
import { useStore } from '@/core/store';
import { agentRegistry } from '@/services/agent/registry';
import { stopBoardroomMission } from '@/services/agent/boardroomMission';
import { secureUUIDv4 } from '@/utils/crypto-random';

import {
    registerBoardroomBrowserReader,
    registerBoardroomFontDownloader,
    type BoardroomBrowserAssignment,
    type BoardroomBrowserPage,
} from '@/services/agent/boardroomBrowserResearch';

interface BrowserState {
    url: string;
    controlGeneration: number;
    navigationGeneration: number;
    controller: 'artist' | 'specialist';
    specialistId?: string;
}

interface FontReceipt { filename: string; size: number }

export default function BoardroomHostedBrowser({ endpoint, initialUrl, onClose }: {
    endpoint: string;
    initialUrl: string;
    onClose: () => void;
}) {
    const socketRef = useRef<WebSocket>();
    const frameRef = useRef('');
    const stateRef = useRef<BrowserState>();
    const inFlight = useRef(true);
    const [retry, setRetry] = useState(0);
    const [closed, setClosed] = useState(false);
    const [pageUrl, setPageUrl] = useState(initialUrl);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const [frame, setFrame] = useState('');
    const [url, setUrl] = useState(initialUrl);
    const lastPage = useRef(initialUrl);
    const resumeId = useRef<string>();
    const [text, setText] = useState('');
    const [reader, setReader] = useState<BoardroomBrowserPage>();
    const [controller, setController] = useState<BrowserState['controller']>('artist');
    const [font, setFont] = useState<FontReceipt & { url: string }>();
    const fontUrl = useRef('');
    const activeAssignment = useRef<BoardroomBrowserAssignment>();
    const pendingRead = useRef<{
        requestId: string;
        resolve: (page: BoardroomBrowserPage) => void;
        reject: (error: Error) => void;
    }>();
    const pendingFont = useRef<{
        requestId: string;
        resolve: (receipt: FontReceipt) => void;
        reject: (error: Error) => void;
    }>();
    const workingStep = useStore(state => state.isAgentProcessing ? state.agentHistory.find(message =>
        message.isStreaming && message.agentId && message.metadata?.boardroomStepStatus === 'working') : undefined);
    const controlRevocation = useStore(state => state.boardroomControlRevocation ?? 0);
    const mayOperate = ready && controller === 'artist';
    const [notice, setNotice] = useState('');
    const captureIntent = useRef<'reader' | 'pin'>('reader');
    const addReference = useStore(state => state.addReferencedAsset);

    useEffect(() => {
        let mounted = true;
        let connection: WebSocket | undefined;
        let incomingFont: (FontReceipt & { requestId: string }) | undefined;
        let shareChanged: (() => void) | undefined;
        inFlight.current = true;
        const revoke = () => {
            activeAssignment.current = undefined;
            pendingRead.current?.reject(new Error('The artist reclaimed the browser.'));
            pendingFont.current?.reject(new Error('The artist reclaimed the browser.'));
            if (connection?.readyState === WebSocket.OPEN) {
                connection.send(JSON.stringify({ type: 'takeover' }));
            }
        };
        const waitForControl = async (assignment: BoardroomBrowserAssignment, notice: string, signal?: AbortSignal) => {
            const hasControl = () => {
                const current = activeAssignment.current;
                return !inFlight.current && stateRef.current?.controller === 'specialist'
                    && current?.requestId === assignment.requestId
                    && current.stepId === assignment.stepId && current.agentId === assignment.agentId;
            };
            if (!hasControl() && !signal?.aborted && connection?.readyState === WebSocket.OPEN) {
                if (shareChanged) throw new Error('Another browser request is waiting for control.');
                setNotice(notice);
                try {
                    await new Promise<void>((resolve, reject) => {
                        const finish = (error?: Error) => {
                            clearTimeout(timeout);
                            shareChanged = undefined;
                            signal?.removeEventListener('abort', cancel);
                            if (error) reject(error);
                            else resolve();
                        };
                        const cancel = () => finish(new Error('Browser control was not granted to this step.'));
                        const timeout = setTimeout(cancel, 30_000);
                        signal?.addEventListener('abort', cancel, { once: true });
                        shareChanged = () => {
                            if (!mounted || connection?.readyState !== WebSocket.OPEN) cancel();
                            else if (hasControl()) finish();
                        };
                    });
                } finally {
                    if (mounted) setNotice('');
                }
            }
            const version = stateRef.current;
            if (!hasControl() || !version || signal?.aborted || connection?.readyState !== WebSocket.OPEN) {
                throw new Error('Share the live browser with this mission step first.');
            }
            return { socket: connection, version };
        };
        const unregister = registerBoardroomBrowserReader(async (url, assignment, signal) => {
            const { socket, version } = await waitForControl(assignment, `Share browser control with ${assignment.agentId} to read the page.`, signal);
            const requestId = secureUUIDv4();
            inFlight.current = true;
            setReady(false);
            return new Promise<BoardroomBrowserPage>((resolve, reject) => {
                const finish = () => {
                    clearTimeout(timeout);
                    signal?.removeEventListener('abort', revoke);
                    pendingRead.current = undefined;
                };
                const timeout = setTimeout(revoke, 45_000);
                signal?.addEventListener('abort', revoke, { once: true });
                pendingRead.current = {
                    requestId,
                    resolve: page => { finish(); resolve(page); },
                    reject: error => { finish(); reject(error); },
                };
                socket.send(JSON.stringify({ ...version, type: 'specialist_read', assignment, requestId, url }));
            });
        });
        const unregisterDownload = registerBoardroomFontDownloader(async (family, assignment, signal) => {
            const { socket, version } = await waitForControl(assignment, `Share browser control with ${assignment.agentId} to download ${family}.`, signal);
            const requestId = secureUUIDv4();
            inFlight.current = true;
            setReady(false);
            setError('');
            return new Promise<FontReceipt>((resolve, reject) => {
                const finish = () => {
                    clearTimeout(timeout);
                    signal?.removeEventListener('abort', revoke);
                    pendingFont.current = undefined;
                };
                const timeout = setTimeout(revoke, 45_000);
                signal?.addEventListener('abort', revoke, { once: true });
                pendingFont.current = {
                    requestId,
                    resolve: receipt => { finish(); resolve(receipt); },
                    reject: error => { finish(); reject(error); },
                };
                socket.send(JSON.stringify({ ...version, type: 'specialist_download_font', assignment, requestId, family }));
            });
        });
        const unsubscribe = useStore.subscribe(state => {
            const assignment = activeAssignment.current;
            if (assignment && (!state.isAgentProcessing || !state.agentHistory.some(message =>
                message.isStreaming && message.agentId === assignment.agentId
                && message.metadata?.boardroomRequestId === assignment.requestId
                && message.metadata?.boardroomStepId === assignment.stepId))) revoke();
        });
        const connect = async () => {
            try {
                const user = auth.currentUser;
                if (!user || user.isAnonymous) {
                    if (mounted) setError('Sign in to indii to open the live browser.');
                    return;
                }
                const token = await user.getIdToken();
                if (!mounted || auth.currentUser !== user) return;
                const socket = new WebSocket(endpoint);
                connection = socket;
                socketRef.current = socket;
                socket.binaryType = 'blob';
                socket.onopen = () => {
                    socket.send(JSON.stringify({ type: 'open', token, url: lastPage.current, resumeId: resumeId.current }));
                    socket.send(JSON.stringify({ type: 'open', token, url: lastPage.current }));
                };
                socket.onmessage = event => {
                    if (!mounted) return;
                    if (event.data instanceof Blob) {
                        const archive = incomingFont;
                        if (archive) {
                            incomingFont = undefined;
                            const pending = pendingFont.current;
                            if (pending?.requestId !== archive.requestId) return;
                            if (event.data.size !== archive.size) {
                                pending.reject(new Error('The downloaded archive could not be delivered.'));
                                return;
                            }
                            if (fontUrl.current) URL.revokeObjectURL(fontUrl.current);
                            const blob = new Blob([event.data], { type: 'application/zip' });
                            fontUrl.current = URL.createObjectURL(blob);
                            setFont({ ...archive, url: fontUrl.current });
                            pending.resolve(archive);
                            return;
                        }
                        const nextFrame = URL.createObjectURL(event.data);
                        if (frameRef.current) URL.revokeObjectURL(frameRef.current);
                        frameRef.current = nextFrame;
                        setFrame(nextFrame);
                        return;
                    }
                    const message = JSON.parse(event.data);
                    switch (message.type) {
                        case 'session':
                            if (typeof message.resumeId === 'string') resumeId.current = message.resumeId;
                            break;
                        case 'state':
                            if (stateRef.current?.url !== message.url) {
                                lastPage.current = message.url;
                                setUrl(message.url);
                                setPageUrl(message.url);
                                setReader(undefined);
                            }
                            stateRef.current = message;
                            setController(message.controller);
                            if (message.controller === 'artist') activeAssignment.current = undefined;
                            break;
                        case 'ready':
                            inFlight.current = false;
                            setReady(true);
                            shareChanged?.();
                            break;
                        case 'error':
                            if (pendingRead.current?.requestId === message.requestId) {
                                pendingRead.current?.reject(new Error(message.message));
                            }
                            if (pendingFont.current?.requestId === message.requestId) {
                                pendingFont.current?.reject(new Error(message.message));
                            }
                            setError(message.message);
                            break;
                        case 'specialist_result':
                            if (pendingRead.current?.requestId === message.requestId) {
                                pendingRead.current?.resolve(message.page);
                            }
                            break;
                        case 'specialist_font': {
                            if (typeof message.requestId === 'string' && typeof message.filename === 'string'
                                && /^[A-Za-z0-9][A-Za-z0-9_-]{0,69}\.zip$/.test(message.filename)
                                && Number.isSafeInteger(message.size) && message.size >= 22 && message.size <= 32 * 1024 * 1024) {
                                incomingFont = { requestId: message.requestId, filename: message.filename, size: message.size };
                            }
                            break;
                        }
                        case 'capture': {
                            const page: BoardroomBrowserPage = message.page;
                            if (captureIntent.current === 'reader') setReader(page);
                            else {
                                addReference({
                                    id: `web-${secureUUIDv4()}`,
                                    name: page.title || page.url,
                                    type: 'url',
                                    value: page.url,
                                    prompt: page.text,
                                    origin: 'boardroom_browser',
                                });
                                setNotice('Page pinned to Swarm.');
                            }
                            break;
                        }
                    }
                };
                socket.onclose = () => {
                    if (!mounted) return;
                    shareChanged?.();
                    activeAssignment.current = undefined;
                    pendingRead.current?.reject(new Error('The live browser disconnected.'));
                    pendingFont.current?.reject(new Error('The live browser disconnected.'));
                    setReady(false);
                    setClosed(true);
                    setError(previous => previous || 'The live browser disconnected. Reconnect to resume browsing.');
                    setError(previous => previous || 'The live browser disconnected. Reconnect to reopen the current address.');
                };
            } catch {
                if (mounted) {
                    setClosed(true);
                    setError('Could not connect to the live browser.');
                }
            }
        };
        void connect();
        return () => {
            mounted = false;
            shareChanged?.();
            unregister();
            unregisterDownload();
            unsubscribe();
            revoke();
            connection?.close(1000);
            connection?.close();
            if (frameRef.current) URL.revokeObjectURL(frameRef.current);
            frameRef.current = '';
            stateRef.current = undefined;
        };
    }, [addReference, endpoint, retry]);

    useEffect(() => () => { if (fontUrl.current) URL.revokeObjectURL(fontUrl.current); }, []);

    const send = (type: string, fields: Record<string, unknown> = {}) => {
        const socket = socketRef.current;
        const version = stateRef.current;
        if (socket?.readyState !== WebSocket.OPEN || !version || inFlight.current) return;
        inFlight.current = true;
        setReady(false);
        setError('');
        setNotice('');
        socket.send(JSON.stringify({ ...version, ...fields, type }));
    };

    const shareWithMission = () => {
        const requestId = workingStep?.metadata?.boardroomRequestId;
        const stepId = workingStep?.metadata?.boardroomStepId;
        const agentId = workingStep?.agentId;
        if (!mayOperate || typeof requestId !== 'string' || typeof stepId !== 'string' || !agentId) return;
        const assignment = { requestId, stepId, agentId };
        activeAssignment.current = assignment;
        send('grant', { assignment });
    };

    const takeControl = () => {
        const socket = socketRef.current;
        if (socket?.readyState !== WebSocket.OPEN) return;
        activeAssignment.current = undefined;
        pendingRead.current?.reject(new Error('The artist reclaimed the browser.'));
        pendingFont.current?.reject(new Error('The artist reclaimed the browser.'));
        socket.send(JSON.stringify({ type: 'takeover' }));
    };

    // Publish hosted browser availability and honor rail "Grant browser control" clicks (spec L4).
    const setHostedBrowserActive = useStore(state => state.setBoardroomHostedBrowserActive);
    const grantRequest = useStore(state => state.boardroomBrowserGrantRequest);
    const lastGrantNonce = useRef(grantRequest?.nonce ?? 0);
    useEffect(() => {
        setHostedBrowserActive?.(true);
        return () => {
            setHostedBrowserActive?.(false);
        };
    }, [setHostedBrowserActive]);

    // Stop mission anywhere in the Boardroom takes the browser back (spec W4/D2).
    const lastRevocation = useRef(controlRevocation);
    useEffect(() => {
        if (controlRevocation === lastRevocation.current) return;
        lastRevocation.current = controlRevocation;
        takeControl();
    }, [controlRevocation]);

    useEffect(() => {
        if (!grantRequest || grantRequest.nonce === lastGrantNonce.current) return;
        lastGrantNonce.current = grantRequest.nonce;
        if (!mayOperate) return;
        const requestId = typeof workingStep?.metadata?.boardroomRequestId === 'string'
            ? workingStep.metadata.boardroomRequestId
            : `rail-request-${grantRequest.nonce}`;
        const stepId = typeof workingStep?.metadata?.boardroomStepId === 'string'
            ? workingStep.metadata.boardroomStepId
            : `rail-grant-${grantRequest.nonce}`;
        const assignment = { requestId, stepId, agentId: grantRequest.agentId };
        activeAssignment.current = assignment;
        send('grant', { assignment });
    }, [grantRequest, mayOperate, workingStep]);

    const controllerAgentId = activeAssignment.current?.agentId ?? workingStep?.agentId;
    const controllerName = controllerAgentId ? (agentRegistry.get(controllerAgentId)?.name ?? controllerAgentId) : 'A specialist';

    return (
        <section className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-3" aria-label="Hosted Boardroom browser">
            <div className="flex flex-wrap items-center gap-3 text-xs">
                <span role="status">{closed ? 'Disconnected' : controller === 'artist' ? 'You have control' : `${controllerName} has control`}</span>
                {controller === 'artist'
                    ? <button type="button" disabled={!mayOperate || !workingStep} onClick={shareWithMission}>
                        Share with {workingStep?.agentId ?? 'running specialist'}
                    </button>
                    : <button type="button" onClick={takeControl}>Take control</button>}
                {workingStep && <button type="button" onClick={() => { stopBoardroomMission(); }}>Stop mission</button>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" onClick={() => send('back')} disabled={!mayOperate}>Back</button>
                <button type="button" onClick={() => send('forward')} disabled={!mayOperate}>Forward</button>
                <button type="button" onClick={() => send('reload')} disabled={!mayOperate}>Reload</button>
                <button type="button" onClick={() => { captureIntent.current = 'reader'; send('capture'); }} disabled={!mayOperate}>Reader</button>
                <button type="button" onClick={() => { captureIntent.current = 'pin'; send('capture'); }} disabled={!mayOperate}>Pin to Boardroom</button>
                <a href={pageUrl} target="_blank" rel="noopener noreferrer">Open externally</a>
                <button type="button" onClick={onClose}>Close live browser</button>
            </div>
            <form className="flex gap-2" onSubmit={event => { event.preventDefault(); send('navigate', { url }); }}>
                <input aria-label="Live browser URL" value={url} onChange={event => setUrl(event.target.value)}
                    className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-sm" />
                <button type="submit" disabled={!mayOperate || !url.trim()}>Go</button>
            </form>
            {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
            {notice && <p role="status" className="text-sm">{notice}</p>}
            {font && <a href={font.url} download={font.filename} className="self-start rounded bg-indigo-600 px-3 py-2 text-sm">
                Save {font.filename}
            </a>}
            {error && closed && (
                <button type="button" className="self-start text-sm underline" onClick={() => {
                    setClosed(false);
                    setError('');
                    setFrame('');
                    setReader(undefined);
                    setRetry(value => value + 1);
                }}>Reconnect</button>
            )}
            {!frame && !error && <p role="status">Starting live browser…</p>}
            {reader && (
                <div className="rounded border border-white/10 p-3">
                    <button type="button" onClick={() => setReader(undefined)}>Close reader</button>
                    <h3 className="font-semibold">{reader.title || reader.url}</h3>
                    <p className="whitespace-pre-wrap text-sm">{reader.text}</p>
                </div>
            )}
            {frame && !reader && (
                <>
                    <button type="button" className="block w-full text-left focus-visible:ring-2 focus-visible:ring-indigo-400"
                        aria-label="Live page. Click to interact, or use the page keyboard controls."
                        onClick={event => {
                            if (!mayOperate || !event.detail) return;
                            const rect = event.currentTarget.getBoundingClientRect();
                            send('click', { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
                        }}
                        onWheel={event => mayOperate && send('scroll', {
                            x: Math.max(-2000, Math.min(2000, event.deltaX)),
                            y: Math.max(-2000, Math.min(2000, event.deltaY)),
                        })}>
                        <img src={frame} alt="" draggable={false} className="block aspect-[4/3] w-full" />
                    </button>
                    <div className="flex gap-3 text-xs">
                        {['Tab', 'Shift+Tab', 'Enter', 'Escape', 'Backspace', 'PageUp', 'PageDown'].map(key => (
                            <button type="button" key={key} disabled={!mayOperate} onClick={() => send('key', { key })}>{key}</button>
                        ))}
                    </div>
                    <form className="flex gap-2" onSubmit={event => {
                        event.preventDefault();
                        if (!mayOperate || !text) return;
                        send('text', { text });
                        setText('');
                    }}>
                        <input aria-label="Text to send to the live page" value={text} maxLength={500}
                            onChange={event => setText(event.target.value)}
                            className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-sm" />
                        <button type="submit" disabled={!mayOperate || !text}>Type into page</button>
                    </form>
                </>
            )}
        </section>
    );
}
