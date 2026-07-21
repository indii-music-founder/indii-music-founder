import { VideoSessionSchema, type VideoSession } from '@indii/shared';
import { httpsCallable } from 'firebase/functions';
import {
    ref,
    uploadBytesResumable,
    type StorageError,
    type UploadTask,
    type UploadTaskSnapshot,
} from 'firebase/storage';
import { functions, storage } from '../firebase';

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
    state: UploadTaskSnapshot['state'];
}

export interface SessionUploadHandle {
    readonly session: VideoSession;
    readonly completion: Promise<UploadTaskSnapshot>;
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
    if (
        candidate.created !== true && candidate.created !== false
        || authorization.storageUri !== expectedUri
        || authorization.expectedMimeType !== session.expectedMimeType
        || authorization.expectedByteSize !== session.expectedByteSize
        || session.expectedMimeType !== file.type
        || session.expectedByteSize !== file.size
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
        const task = uploadBytesResumable(
            ref(storage, authorization.session.stagingPath),
            file,
            {
                contentType: authorization.upload.expectedMimeType,
                cacheControl: 'private, no-store',
                customMetadata: authorization.upload.requiredMetadata,
            },
        );
        const completion = new Promise<UploadTaskSnapshot>((resolve, reject) => {
            task.on(
                'state_changed',
                (snapshot) => onProgress?.({
                    bytesTransferred: snapshot.bytesTransferred,
                    totalBytes: snapshot.totalBytes,
                    percent: snapshot.totalBytes === 0 ? 0 : snapshot.bytesTransferred / snapshot.totalBytes * 100,
                    state: snapshot.state,
                }),
                (error: StorageError) => reject(error),
                () => resolve(task.snapshot),
            );
        });
        return new FirebaseSessionUploadHandle(authorization.session, task, completion);
    }
}

class FirebaseSessionUploadHandle implements SessionUploadHandle {
    private cancellation?: Promise<void>;

    constructor(
        readonly session: VideoSession,
        private readonly task: UploadTask,
        readonly completion: Promise<UploadTaskSnapshot>,
    ) {}

    pause(): boolean {
        return this.task.pause();
    }

    resume(): boolean {
        return this.task.resume();
    }

    cancel(): Promise<void> {
        if (!this.cancellation) {
            this.task.cancel();
            const cancelSession = httpsCallable<{ sessionId: string }, unknown>(functions, 'cancelVideoSession');
            this.cancellation = cancelSession({ sessionId: this.session.sessionId }).then(() => undefined);
        }
        return this.cancellation;
    }
}
