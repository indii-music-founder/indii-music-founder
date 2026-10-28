import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { functions, storage, auth } from '@/services/firebase';
import { HostedRightsConnectionLifecycle } from './HostedRightsConnectionLifecycle';
import type { RightsCase, CopyrightWork, CwrBatchInput, SessionInput } from '@indii/shared';

export async function rightsOperation<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Sign in to manage your filings.');
  const result = await httpsCallable(functions, 'rightsRegistration')({ action, payload });
  return result.data as T;
}
export async function uploadRightsDeposit(file: File): Promise<CopyrightWork['deposit']> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to prepare a deposit.');
  if (file.size > 500 * 1024 * 1024) throw new Error('The deposit exceeds 500 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mime = ({ wav: 'audio/wav', mp3: 'audio/mpeg', flac: 'audio/flac', pdf: 'application/pdf', aif: 'audio/aiff', aiff: 'audio/aiff', m4a: 'audio/mp4' } as Record<string, string>)[ext ?? ''];
  if (!mime) throw new Error('Choose WAV, MP3, FLAC, AIFF, M4A, or PDF.');
  const path = `users/${uid}/rights/deposits/${crypto.randomUUID()}.${ext}`;
  const uploaded = await uploadBytesResumable(ref(storage, path), file, { contentType: mime });
  return rightsOperation('prepare_deposit', { path, generation: uploaded.metadata.generation });
}
export async function saveRightsCase(manifest: RightsCase) {
  return rightsOperation<{ caseId: string; filingId: string; manifestHash: string; errors: string[] }>('save_case', manifest as unknown as Record<string, unknown>);
}
export async function exportRightsCwr(input: CwrBatchInput) {
  return rightsOperation<{ batchId: string; filename: string; text: string; checksum: string }>('build_cwr', input as unknown as Record<string, unknown>);
}
export function downloadRightsFile(filename: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The reconnecting transport never records frames or input and never replays input. */
export class HostedRightsConnection {
  private socket?: WebSocket;
  private lifecycle = new HostedRightsConnectionLifecycle();
  private sequence = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private fence = { controlGeneration: 0, navigationGeneration: 0, viewportVersion: 1, control: 'none' };
  constructor(private sessionId: string, private onEvent: (event: Record<string, unknown>) => void, private onFrame: (frame: Blob) => void) {}
  async connect() {
    const generation = this.lifecycle.begin();
    if (generation === undefined) return;
    clearTimeout(this.retry);
    try {
      const { ticket, brokerUrl } = await rightsOperation<{ ticket: string; brokerUrl: string }>('connect_ticket', { sessionId: this.sessionId });
      // Closing while ticket acquisition is pending must never open a socket.
      if (!this.lifecycle.isCurrent(generation)) return;
      const url = new URL('/session', brokerUrl); url.protocol = 'wss:';
      const socket = new WebSocket(url); socket.binaryType = 'blob'; this.socket = socket;
      socket.onopen = () => {
        if (!this.lifecycle.connected(generation)) { socket.close(); return; }
        socket.send(JSON.stringify({ kind: 'client', sessionId: this.sessionId, ticket }));
      };
      socket.onmessage = event => {
        if (!this.lifecycle.isCurrent(generation)) return;
        if (event.data instanceof Blob) { this.onFrame(event.data); return; }
        const value = JSON.parse(event.data);
        if (value.type === 'status') {
          this.fence.control = value.control;
          if (this.fence.controlGeneration !== value.controlGeneration) this.sequence = 0;
          this.fence.controlGeneration = value.controlGeneration;
          if (['ended', 'failed', 'termination_pending'].includes(value.state)) this.close();
        }
        if (value.type === 'navigation') {
          this.fence.navigationGeneration = value.navigationGeneration;
          this.fence.viewportVersion = value.viewportVersion;
          this.fence.control = 'none';
        }
        this.onEvent(value);
      };
      socket.onclose = () => {
        if (!this.lifecycle.disconnected(generation)) return;
        this.fence.control = 'none';
        this.socket = undefined;
        this.retry = setTimeout(() => { if (this.lifecycle.canRetry(generation)) void this.connect(); }, 3000);
        this.onEvent({ type: 'status', state: 'reconnecting', control: 'none' });
      };
      socket.onerror = () => { if (this.lifecycle.isCurrent(generation)) socket.close(); };
    } catch (error) {
      if (!this.lifecycle.disconnected(generation)) return;
      this.fence.control = 'none';
      this.onEvent({ type: 'error', message: error instanceof Error ? error.message : 'Session connection unavailable.' });
    }
  }
  input(event: SessionInput['event']) {
    if (!this.lifecycle.isConnected || this.fence.control !== 'human' || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ sessionId: this.sessionId, ...this.fence, sequence: ++this.sequence, event,
      // control belongs to status only, not the validated wire schema.
    }, (key, value) => key === 'control' ? undefined : value));
  }
  close() {
    this.lifecycle.close();
    clearTimeout(this.retry);
    this.fence.control = 'none';
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }
}
