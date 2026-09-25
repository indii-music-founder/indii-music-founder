import { createHash, randomBytes } from 'node:crypto';

export type ComputerAction = 'screenshot' | 'open_app' | 'click' | 'key' | 'scroll' | 'drive';

export interface VerifiedComputerIdentity { uid: string }

export interface StoredComputerApproval {
    id: string;
    userId: string;
    agentId: string;
    toolName: string;
    args: Record<string, unknown>;
    status: 'pending' | 'approved' | 'claimed' | 'denied' | 'executed' | 'failed' | 'revoked';
    createdAtMs: number;
}

export interface ComputerAuthorizationBackend {
    verifyIdentity(idToken: string): Promise<VerifiedComputerIdentity>;
    hasComputerControlOptIn(uid: string, idToken: string): Promise<boolean>;
    getApproval(uid: string, approvalId: string, idToken: string): Promise<StoredComputerApproval | null>;
    claimApproval(uid: string, approval: StoredComputerApproval, idToken: string): Promise<StoredComputerApproval>;
}

export interface ComputerApprovalScope { userId: string; approvalId: string; agentId: string; toolName: string; action: ComputerAction; args: Record<string, unknown> }

interface Capability {
    uid: string;
    approvalId: string;
    rendererId: number;
    rendererSessionId: string;
    agentId: string;
    toolName: string;
    action: ComputerAction;
    argsDigest: string;
    expiresAt: number;
    state: 'active' | 'consumed' | 'revoked';
}

interface DriveCapability {
    rendererId: number;
    rendererSessionId: string;
    agentId: string;
    allowedActions: ReadonlySet<ComputerAction>;
    expiresAt: number;
    remainingActions: number;
    revoked: boolean;
}

const TOOL_ACTION: Readonly<Record<string, ComputerAction>> = {
    computer_screenshot: 'screenshot',
    computer_open_app: 'open_app',
    computer_click: 'click',
    computer_key: 'key',
    computer_scroll: 'scroll',
    computer_drive: 'drive',
};

function canonical(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

export function normalizeComputerArgs(action: ComputerAction, args: Record<string, unknown>): Record<string, unknown> {
    switch (action) {
        case 'screenshot': return args.displayId === undefined ? {} : { displayId: args.displayId };
        case 'open_app': return { app: args.app };
        case 'click': return { x: args.x, y: args.y, button: args.button ?? 'left' };
        case 'key': return { combo: args.combo };
        case 'scroll': return { dx: args.dx, dy: args.dy };
        case 'drive': return { goal: args.goal, maxSteps: args.maxSteps ?? 15 };
    }
}

function digest(action: ComputerAction, args: Record<string, unknown>): string {
    return createHash('sha256').update(canonical(normalizeComputerArgs(action, args))).digest('hex');
}

export class ComputerAuthorizationService {
    private readonly capabilities = new Map<string, Capability>();
    private readonly driveCapabilities = new Map<string, DriveCapability>();
    private readonly pendingClaims = new Set<string>();

    constructor(
        private readonly backend: ComputerAuthorizationBackend,
        private readonly now: () => number = Date.now,
        private readonly approvalMaxAgeMs = 5 * 60_000,
        private readonly capabilityTtlMs = 60_000,
    ) {}

    async authorize(input: { idToken: string; approvalId: string; rendererId: number; rendererSessionId: string; confirm: (scope: ComputerApprovalScope) => Promise<boolean> }): Promise<{ token: string; expiresAt: number }> {
        if (!input.idToken || !input.approvalId || !input.rendererSessionId) throw new Error('Computer authorization requires identity, approval, and renderer session.');
        const identity = await this.backend.verifyIdentity(input.idToken);
        if (!identity.uid) throw new Error('Computer authorization requires a verified signed-in user.');
        if (!await this.backend.hasComputerControlOptIn(identity.uid, input.idToken)) throw new Error('Computer control is disabled in the Artist Operating Profile.');
        const approval = await this.backend.getApproval(identity.uid, input.approvalId, input.idToken);
        if (!approval || approval.userId !== identity.uid) throw new Error('Approval does not belong to the verified user.');
        if (approval.status !== 'pending') throw new Error(`Approval is not usable (status: ${approval.status}).`);
        const action = TOOL_ACTION[approval.toolName];
        if (!action) throw new Error('Approval is not for a supported computer-control tool.');
        const age = this.now() - approval.createdAtMs;
        if (age < 0 || age > this.approvalMaxAgeMs) throw new Error('Approval is expired.');

        const claimKey = `${identity.uid}:${approval.id}`;
        if (this.pendingClaims.has(claimKey)) throw new Error('Approval is already being confirmed.');
        this.pendingClaims.add(claimKey);
        let claimed: StoredComputerApproval;
        try {
            const scope = { userId: identity.uid, approvalId: approval.id, agentId: approval.agentId, toolName: approval.toolName, action, args: normalizeComputerArgs(action, approval.args) };
            if (!await input.confirm(scope)) throw new Error('Computer approval was cancelled by the user.');
            claimed = await this.backend.claimApproval(identity.uid, approval, input.idToken);
        } finally {
            this.pendingClaims.delete(claimKey);
        }
        if (claimed.status !== 'claimed' || claimed.userId !== identity.uid || claimed.id !== approval.id || claimed.agentId !== approval.agentId || claimed.toolName !== approval.toolName || digest(action, claimed.args) !== digest(action, approval.args)) {
            throw new Error('Trusted approval claim did not preserve the approved scope.');
        }
        this.prune();
        const token = randomBytes(32).toString('base64url');
        const expiresAt = this.now() + this.capabilityTtlMs;
        this.capabilities.set(token, {
            uid: identity.uid, approvalId: approval.id, rendererId: input.rendererId,
            rendererSessionId: input.rendererSessionId, agentId: approval.agentId,
            toolName: approval.toolName, action, argsDigest: digest(action, approval.args),
            expiresAt, state: 'active',
        });
        return { token, expiresAt };
    }

    consume(input: { token: string; rendererId: number; rendererSessionId: string; agentId: string; toolName: string; action: ComputerAction; args: Record<string, unknown> }): Capability {
        const capability = this.capabilities.get(input.token);
        if (!capability || capability.state !== 'active') throw new Error('Computer approval is missing, revoked, or already used.');
        if (capability.expiresAt <= this.now()) { capability.state = 'revoked'; throw new Error('Computer approval is expired.'); }
        if (capability.rendererId !== input.rendererId || capability.rendererSessionId !== input.rendererSessionId) throw new Error('Computer approval belongs to a different renderer session.');
        if (capability.agentId !== input.agentId) throw new Error('Computer approval belongs to a different agent.');
        if (capability.toolName !== input.toolName || capability.action !== input.action) throw new Error('Computer approval does not cover this tool or action.');
        if (capability.argsDigest !== digest(input.action, input.args)) throw new Error('Computer action arguments differ from the approved arguments.');
        // Synchronous transition before any provider await makes concurrent replay fail closed.
        capability.state = 'consumed';
        return capability;
    }

    beginDrive(input: { token: string; rendererId: number; rendererSessionId: string; agentId: string; args: Record<string, unknown> }): { sessionToken: string; expiresAt: number } {
        const capability = this.consume({ ...input, toolName: 'computer_drive', action: 'drive' });
        const maxSteps = Number(normalizeComputerArgs('drive', input.args).maxSteps);
        const sessionToken = randomBytes(32).toString('base64url');
        const expiresAt = Math.min(capability.expiresAt, this.now() + this.capabilityTtlMs);
        this.driveCapabilities.set(sessionToken, {
            rendererId: input.rendererId, rendererSessionId: input.rendererSessionId,
            agentId: input.agentId,
            allowedActions: new Set(['screenshot', 'click', 'key', 'scroll']),
            expiresAt, remainingActions: Math.max(1, Math.min(100, maxSteps * 3 + 1)), revoked: false,
        });
        return { sessionToken, expiresAt };
    }

    consumeDriveAction(input: { sessionToken: string; rendererId: number; rendererSessionId: string; agentId: string; action: ComputerAction }): void {
        const session = this.driveCapabilities.get(input.sessionToken);
        if (!session || session.revoked) throw new Error('Computer drive authorization is missing or revoked.');
        if (session.expiresAt <= this.now()) { session.revoked = true; throw new Error('Computer drive authorization is expired.'); }
        if (session.rendererId !== input.rendererId || session.rendererSessionId !== input.rendererSessionId) throw new Error('Computer drive authorization belongs to a different renderer session.');
        if (session.agentId !== input.agentId) throw new Error('Computer drive authorization belongs to a different agent.');
        if (!session.allowedActions.has(input.action)) throw new Error('Computer drive approval does not cover this action.');
        if (session.remainingActions <= 0) throw new Error('Computer drive authorization action limit reached.');
        session.remainingActions -= 1;
    }

    revoke(token: string): void {
        const capability = this.capabilities.get(token);
        if (capability) capability.state = 'revoked';
        const drive = this.driveCapabilities.get(token);
        if (drive) drive.revoked = true;
    }

    revokeAllDriveSessions(): void {
        for (const session of this.driveCapabilities.values()) session.revoked = true;
        this.prune();
    }

    private prune(): void {
        const now = this.now();
        for (const [token, capability] of this.capabilities) if (capability.state !== 'active' || capability.expiresAt <= now) this.capabilities.delete(token);
        for (const [token, session] of this.driveCapabilities) if (session.revoked || session.expiresAt <= now) this.driveCapabilities.delete(token);
    }
}
