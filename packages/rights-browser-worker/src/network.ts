import { createServer } from 'node:http';
import { lookup } from 'node:dns/promises';
import { connect, isIPv4 } from 'node:net';

export function isPublicAddress(address: string): boolean {
  if (!isIPv4(address)) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19].includes(b))
    || (a === 192 && b === 0 && [0, 2].includes(c)) || (a === 192 && b === 88 && c === 99)
    || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
}

/** HTTPS CONNECT proxy pins validated DNS to the actual socket, preventing rebinding. */
export async function createPortalProxy(hostAllowed: (host: string) => boolean) {
  const server = createServer((_req, res) => { res.writeHead(403); res.end(); });
  server.on('connect', (request, client, head) => {
    void (async () => {
      const destination = new URL('https://' + request.url);
      if (!hostAllowed(destination.hostname) || (destination.port && destination.port !== '443') || destination.username || destination.password) throw new Error('Origin blocked');
      const addresses = await lookup(destination.hostname, { all: true, family: 4 });
      if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Address blocked');
      const upstream = connect({ host: addresses[0].address, port: 443 });
      upstream.once('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        client.pipe(upstream); upstream.pipe(client);
      });
      upstream.on('error', () => client.destroy());
      client.on('error', () => upstream.destroy());
      client.on('close', () => upstream.destroy());
      upstream.setTimeout(120_000, () => upstream.destroy());
    })().catch(() => client.destroy());
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Proxy unavailable');
  return { url: 'http://127.0.0.1:' + address.port, close: () => server.close() };
}
