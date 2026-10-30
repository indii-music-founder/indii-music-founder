import net from 'net';

export interface LiveBlenderResponse<T = unknown> {
    status?: 'ok' | 'error';
    version?: string;
    blender?: string;
    error?: string;
    result?: T;
}

export async function sendLiveBlenderCommand<T = unknown>(
    action: string,
    params: Record<string, unknown> = {},
    host = '127.0.0.1',
    port = 9876,
    timeoutMs?: number
): Promise<LiveBlenderResponse<T>> {
    // Pairing is host configuration, never an agent-supplied tool argument.
    const token = process.env.INDII_BLENDER_PAIRING_TOKEN;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return { status: 'error', error: 'Pair the Blender session in desktop settings first.' };
    if (!['ping', 'get_scene_info', 'set_frame'].includes(action)) return { status: 'error', error: 'Unsupported declarative Blender command.' };
    const keys = Object.keys(params);
    if (action === 'set_frame'
        ? keys.length !== 1 || keys[0] !== 'frame' || !Number.isInteger(params.frame) || (params.frame as number) < 1 || (params.frame as number) > 1000000
        : keys.length !== 0) {
        return { status: 'error', error: 'Invalid declarative Blender command parameters.' };
    }
    const resolvedTimeoutMs = Math.min(15000, Math.max(100, Number.isFinite(timeoutMs) ? timeoutMs! : 10000));

    return new Promise((resolve) => {
        const client = new net.Socket();
        let receivedData = '';

        const timer = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', error: `Connection to Blender live bridge (${host}:${port}) timed out after ${resolvedTimeoutMs}ms.` });
        }, resolvedTimeoutMs);

        client.connect(port, host, () => {
            const payload = JSON.stringify({ action, params, token }) + '\n';
            client.write(payload);
        });

        client.on('data', (chunk) => {
            receivedData += chunk.toString('utf-8');
            if (Buffer.byteLength(receivedData) > 65536) {
                clearTimeout(timer); client.destroy();
                resolve({ status: 'error', error: 'Blender response exceeded the size limit.' });
            }
        });

        client.on('end', () => {
            clearTimeout(timer);
            try {
                const parsed = JSON.parse(receivedData) as LiveBlenderResponse<T>;
                if (!parsed || !['ok', 'error'].includes(parsed.status || '')) throw new Error('Invalid response status');
                resolve(parsed);
            } catch {
                resolve({ status: 'error', error: 'Blender returned an invalid response.' });
            }
        });

        client.on('error', (err) => {
            clearTimeout(timer);
            resolve({ status: 'error', error: `Blender live bridge error: ${err.message}` });
        });
    });
}

export async function checkLiveBlenderConnected(host = '127.0.0.1', port = 9876): Promise<boolean> {
    const res = await sendLiveBlenderCommand('ping', {}, host, port, 1500);
    return res.status === 'ok';
}
