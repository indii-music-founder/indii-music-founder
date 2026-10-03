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
    timeoutMs = 5000
): Promise<LiveBlenderResponse<T>> {
    return new Promise((resolve) => {
        const client = new net.Socket();
        let receivedData = '';

        const timer = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', error: `Connection to Blender live bridge (${host}:${port}) timed out.` });
        }, timeoutMs);

        client.connect(port, host, () => {
            const payload = JSON.stringify({ action, params });
            client.write(payload);
        });

        client.on('data', (chunk) => {
            receivedData += chunk.toString('utf-8');
        });

        client.on('end', () => {
            clearTimeout(timer);
            try {
                const parsed = JSON.parse(receivedData) as LiveBlenderResponse<T>;
                resolve(parsed);
            } catch {
                resolve({ status: 'ok', result: receivedData as unknown as T });
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
