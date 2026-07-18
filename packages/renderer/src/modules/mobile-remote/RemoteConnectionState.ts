export type RemoteConnectionPhase =
    | 'signed_out'
    | 'controller_authenticated'
    | 'studio_offline'
    | 'recovering'
    | 'connected'
    | 'error';

export function getRemoteConnectionPhase(input: {
    authenticated: boolean;
    paired: boolean;
    reconnecting: boolean;
    status: 'idle' | 'pairing' | 'connected' | 'error';
}): RemoteConnectionPhase {
    if (!input.authenticated) return 'signed_out';
    if (input.status === 'error') return 'error';
    if (input.status === 'connected') return 'connected';
    if (input.reconnecting) return 'recovering';
    if (input.paired) return 'studio_offline';
    return 'controller_authenticated';
}
