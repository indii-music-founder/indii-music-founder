import { VideoSessionSchema, type VideoSession } from '@shared';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const MAX_SESSION_BYTES = 20 * 1024 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
]);

export interface CreateSessionUploadRequest {
    organizationId: string;
    projectId: string;
    idempotencyKey: string;
}

interface ServerUploadAuthorization {
    storageUri: string;
    expectedMimeType: string;
    expectedByteSize: number;
    requiredMetadata: Record<'ownerUid' | 'organizationId' | 'projectId' | 'sessionId' | 'uploadSessionId', string>;
    protocol: 'gcs-resumable.v1';
    resumableSessionUri: string;
    chunkSizeBytes: number;
    expiresAt: string;
}

interface CreateSessionResponse {
    created: boolean;
    session: VideoSession;
    upload: ServerUploadAuthorization;
}

export interface SessionUploadProgress {
    bytesTransferred: number;
    totalBytes: number;
    percent: number;
    state: 'running' | 'paused' | 'success' | 'canceled';
}

export interface SessionUploadCompletion {
    bytesTransferred: number;
    totalBytes: number;
    state: 'success';
}

export interface SessionUploadHandle {
    readonly session: VideoSession;
    readonly completion: Promise<SessionUploadCompletion>;
    pause(): boolean;
    resume(): boolean;
    cancel(): Promise<void>;
}

function validateFile(file: File | Blob): void {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
        throw new Error('Long session recordings must be MP4, QuickTime, WebM, or M4V video.');
    }
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_SESSION_BYTES) {
        throw new Error('Long session recordings must be between 1 byte and 20 GiB.');
    }
}

function parseAuthorization(raw: unknown, file: File | Blob): CreateSessionResponse {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('The upload authorization response is malformed.');
    }
    const candidate = raw as Record<string, unknown>;
    const parsedSession = VideoSessionSchema.safeParse(candidate.session);
    const upload = candidate.upload;
    if (!parsedSession.success || !upload || typeof upload !== 'object' || Array.isArray(upload)) {
        throw new Error('The upload authorization response failed contract validation.');
    }
    const authorization = upload as Record<string, unknown>;
    const metadata = authorization.requiredMetadata;
    const session = parsedSession.data;
    const expectedUri = `gs://${session.stagingBucket}/${session.stagingPath}`;
    let resumableSessionUri: URL;
    try {
        resumableSessionUri = new URL(String(authorization.resumableSessionUri ?? ''));
    } catch {
        throw new Error('The resumable upload authorization URI is malformed.');
    }
    if (
        candidate.created !== true && candidate.created !== false
        || authorization.storageUri !== expectedUri
        || authorization.expectedMimeType !== session.expectedMimeType
        || authorization.expectedByteSize !== session.expectedByteSize
        || session.expectedMimeType !== file.type
        || session.expectedByteSize !== file.size
        || authorization.protocol !== 'gcs-resumable.v1'
        || resumableSessionUri.protocol !== 'https:'
        || !['storage.googleapis.com', 'www.googleapis.com'].includes(resumableSessionUri.hostname)
        || !Number.isSafeInteger(authorization.chunkSizeBytes)
        || Number(authorization.chunkSizeBytes) < 256 * 1024
        || Number(authorization.chunkSizeBytes) % (256 * 1024) !== 0
        || typeof authorization.expiresAt !== 'string'
        || !Number.isFinite(Date.parse(authorization.expiresAt))
        || Date.parse(authorization.expiresAt) <= Date.now()
        || !metadata || typeof metadata !== 'object' || Array.isArray(metadata)
    ) {
        throw new Error('The upload authorization does not match the selected file.');
    }
    const requiredMetadata = metadata as Record<string, unknown>;
    const expectedMetadata = {
        ownerUid: session.ownerUid,
        organizationId: session.organizationId,
        projectId: session.projectId,
        sessionId: session.sessionId,
        uploadSessionId: session.uploadSessionId,
    };
    if (Object.entries(expectedMetadata).some(([key, value]) => requiredMetadata[key] !== value)) {
        throw new Error('The upload authorization identity does not match its session.');
    }
    return {
        created: candidate.created,
        session,
        upload: {
            storageUri: expectedUri,
            expectedMimeType: session.expectedMimeType,
            expectedByteSize: session.expectedByteSize,
            requiredMetadata: expectedMetadata,
            protocol: 'gcs-resumable.v1',
            resumableSessionUri: resumableSessionUri.toString(),
            chunkSizeBytes: Number(authorization.chunkSizeBytes),
            expiresAt: authorization.expiresAt,
        },
    };
}

export class SessionVideoUploadService {
    static async start(
        file: File | Blob,
        request: CreateSessionUploadRequest,
        onProgress?: (progress: SessionUploadProgress) => void,
    ): Promise<SessionUploadHandle> {
        validateFile(file);
        const createSession = httpsCallable<
            CreateSessionUploadRequest & { expectedMimeType: string; expectedByteSize: number },
            unknown
        >(functions, 'createVideoSession');
        const response = await createSession({
            ...request,
            expectedMimeType: file.type,
            expectedByteSize: file.size,
        });
        const authorization = parseAuthorization(response.data, file);
        return new GcsResumableSessionUploadHandle(
            authorization.session,
            authorization.upload,
            file,
            onProgress,
        );
    }
}

function committedOffset(response: Response, totalBytes: number): number {
    if (response.status === 200 || response.status === 201) return totalBytes;
    if (response.status !== 308) {
        if (response.status === 404 || response.status === 410) {
            throw new Error('The resumable upload session expired. Start the upload again to receive a new authorization.');
        }
        throw new Error(`The resumable upload endpoint rejected the request (${response.status}).`);
    }
    const range = response.headers.get('Range');
    if (!range) return 0;
    const match = /^bytes=0-(\d+)$/.exec(range);
    const finalByte = match ? Number(match[1]) : Number.NaN;
    if (!Number.isSafeInteger(finalByte) || finalByte < 0 || finalByte >= totalBytes) {
        throw new Error('The resumable upload endpoint returned an invalid committed byte range.');
    }
    return finalByte + 1;
}

class ResumeStatusRequired extends Error {}

class GcsResumableSessionUploadHandle implements SessionUploadHandle {
    private cancellation?: Promise<void>;
    private activeRequest?: AbortController;
    private readonly pauseAbortedRequests = new WeakSet<AbortController>();
    private paused = false;
    private cancelled = false;
    private resumeWaiter?: () => void;
    private committedBytes = 0;
    readonly completion: Promise<SessionUploadCompletion>;

    constructor(
        readonly session: VideoSession,
        private readonly authorization: ServerUploadAuthorization,
        private readonly file: File | Blob,
        private readonly onProgress?: (progress: SessionUploadProgress) => void,
    ) {
        this.completion = this.upload();
    }

    pause(): boolean {
        if (this.paused || this.cancelled) return false;
        this.paused = true;
        if (this.activeRequest) {
            this.pauseAbortedRequests.add(this.activeRequest);
            this.activeRequest.abort();
        }
        this.report(this.committedBytes, 'paused');
        return true;
    }

    resume(): boolean {
        if (!this.paused || this.cancelled) return false;
        this.paused = false;
        this.resumeWaiter?.();
        this.resumeWaiter = undefined;
        return true;
    }

    cancel(): Promise<void> {
        if (!this.cancellation) {
            this.cancelled = true;
            this.paused = false;
            this.activeRequest?.abort();
            this.resumeWaiter?.();
            this.resumeWaiter = undefined;
            const cancelSession = httpsCallable<{ sessionId: string }, unknown>(functions, 'cancelVideoSession');
            this.cancellation = cancelSession({ sessionId: this.session.sessionId }).then(() => undefined);
        }
        return this.cancellation;
    }

    private report(bytesTransferred: number, state: SessionUploadProgress['state']): void {
        this.onProgress?.({
            bytesTransferred,
            totalBytes: this.file.size,
            percent: this.file.size === 0 ? 0 : bytesTransferred / this.file.size * 100,
            state,
        });
    }

    private async waitUntilActive(): Promise<void> {
        if (this.cancelled) throw new Error('The session upload was cancelled.');
        if (!this.paused) return;
        await new Promise<void>((resolve) => {
            this.resumeWaiter = resolve;
        });
        if (this.cancelled) throw new Error('The session upload was cancelled.');
    }

    private async put(headers: Record<string, string>, body: Blob | null): Promise<Response> {
        await this.waitUntilActive();
        const controller = new AbortController();
        this.activeRequest = controller;
        try {
            return await fetch(this.authorization.resumableSessionUri, {
                method: 'PUT',
                headers,
                body,
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                signal: controller.signal,
            });
        } catch (error: unknown) {
            if (controller.signal.aborted && this.pauseAbortedRequests.has(controller) && !this.cancelled) {
                await this.waitUntilActive();
                throw new ResumeStatusRequired();
            }
            if (this.cancelled) throw new Error('The session upload was cancelled.');
            throw error;
        } finally {
            if (this.activeRequest === controller) this.activeRequest = undefined;
        }
    }

    private async queryCommittedOffset(): Promise<number> {
        while (true) {
            try {
                return committedOffset(await this.put({
                    'Content-Range': `bytes */${this.file.size}`,
                }, null), this.file.size);
            } catch (error) {
                if (!(error instanceof ResumeStatusRequired)) throw error;
            }
        }
    }

    private async upload(): Promise<SessionUploadCompletion> {
        let offset = await this.queryCommittedOffset();
        this.committedBytes = offset;
        this.report(offset, offset === this.file.size ? 'success' : 'running');

        while (offset < this.file.size) {
            await this.waitUntilActive();
            const endExclusive = Math.min(offset + this.authorization.chunkSizeBytes, this.file.size);
            let response: Response;
            try {
                response = await this.put({
                    'Content-Range': `bytes ${offset}-${endExclusive - 1}/${this.file.size}`,
                    'Content-Type': this.authorization.expectedMimeType,
                }, this.file.slice(offset, endExclusive, this.authorization.expectedMimeType));
            } catch (error) {
                if (!(error instanceof ResumeStatusRequired)) throw error;
                offset = await this.queryCommittedOffset();
                this.committedBytes = offset;
                this.report(offset, offset === this.file.size ? 'success' : 'running');
                continue;
            }
            const nextOffset = committedOffset(response, this.file.size);
            if (nextOffset <= offset) {
                throw new Error('The resumable upload endpoint did not commit the submitted byte range.');
            }
            offset = nextOffset;
            this.committedBytes = offset;
            this.report(offset, offset === this.file.size ? 'success' : 'running');
        }

        return {
            bytesTransferred: this.file.size,
            totalBytes: this.file.size,
            state: 'success',
        };
    }
}
