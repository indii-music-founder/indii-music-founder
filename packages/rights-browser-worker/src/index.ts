import { chromium, type BrowserContext, type CDPSession, type Page } from 'playwright';
import { WebSocket } from 'ws';
import { GoogleAuth } from 'google-auth-library';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acceptHumanInput, SessionInputSchema, RightsCaseSchema, RIGHTS_LIMITS, type RightsSessionFence, type RightsCase } from '@indii/shared';
import { createPortalProxy } from './network.js';
import { executeCopyrightAction } from './adapters.js';

const sessionId = process.env.RIGHTS_SESSION_ID!;
const ownerUid = process.env.RIGHTS_OWNER_UID!;
const executionSecret = process.env.RIGHTS_EXECUTION_SECRET!;
const brokerUrl = process.env.RIGHTS_BROKER_URL!;
const executionId = process.env.CLOUD_RUN_EXECUTION ?? randomUUID();
if (!sessionId || !ownerUid || !executionSecret || !brokerUrl || new URL(brokerUrl).protocol !== 'https:') throw new Error('Rights worker configuration required');
const fence: RightsSessionFence = { sessionId, control: 'none', controlGeneration: 0, navigationGeneration: 0, viewportVersion: 1, lastSequence: 0 };
let socket: WebSocket;
let context: BrowserContext | undefined, page: Page | undefined, cdp: CDPSession | undefined, manifest: RightsCase | undefined;
let clientPresent = false, closing = false, paymentEnabled = false;
let expiresAtMs = Date.now() + RIGHTS_LIMITS.sessionMs, lastActivity = Date.now(), lastActivitySent = 0;
let operations: Promise<void> = Promise.resolve();
const commandsSeen = new Set<string>();
const temp = await mkdtemp(join(tmpdir(), 'rights-browser-'));
const stagedFiles: string[] = [];
const send = (value: unknown) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); };
const extraHosts = (process.env.RIGHTS_VERIFIED_RESOURCE_HOSTS ?? '').split(',').filter(Boolean);
const hostAllowed = (host: string) => ['eco.copyright.gov', 'www.copyright.gov', 'copyright.gov'].includes(host)
  || (paymentEnabled && (host === 'pay.gov' || host === 'www.pay.gov')) || extraHosts.includes(host);
const proxy = await createPortalProxy(hostAllowed);

async function attachPage(next: Page) {
  await cdp?.send('Page.stopScreencast').catch(() => {});
  await cdp?.detach().catch(() => {});
  page = next; cdp = await context!.newCDPSession(next);
  next.on('framenavigated', frame => {
    if (frame !== next.mainFrame()) return;
    fence.control = 'none'; fence.navigationGeneration++;
    send({ type: 'navigation', navigationGeneration: fence.navigationGeneration, viewportVersion: fence.viewportVersion });
    send({ type: 'control_ack', control: 'none', generation: fence.controlGeneration });
  });
  next.on('filechooser', chooser => {
    // Human opens the deposit picker in the official application after payment.
    if (fence.control === 'human' && stagedFiles.length) void chooser.setFiles(stagedFiles).catch(() => send({ type: 'error', code: 'DEPOSIT_UPLOAD_FAILED' }));
  });
  cdp.on('Page.screencastFrame', event => {
    void cdp?.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    if (clientPresent && socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 512 * 1024) socket.send(Buffer.from(event.data, 'base64'), { binary: true });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 65, maxWidth: 1200, maxHeight: 900, everyNthFrame: 1 });
}
async function end() {
  if (closing) return;
  closing = true; fence.control = 'none';
  await operations.catch(() => {});
  await context?.close(); proxy.close();
  await rm(temp, { recursive: true, force: true });
  send({ type: 'ended' }); socket?.close();
}

async function handle(packet: Record<string, any>) {
  if (packet.type === 'configuration') {
    paymentEnabled = packet.paymentEnabled === true;
    manifest = RightsCaseSchema.parse(packet.manifest);
    fence.controlGeneration = packet.generation;
    fence.control = 'none'; fence.lastSequence = 0;
    expiresAtMs = packet.expiresAtMs;
    if (!context) {
      const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, chromiumSandbox: true, proxy: { server: proxy.url, bypass: '<-loopback>' },
        args: ['--disable-dev-shm-usage', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'] });
      context = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: false, serviceWorkers: 'block', storageState: packet.storageState });
      await context.route('**/*', route => {
        let permitted = false;
        try { const url = new URL(route.request().url()); permitted = url.protocol === 'https:' && hostAllowed(url.hostname); } catch { /* deny */ }
        return permitted ? route.continue() : route.abort('blockedbyclient');
      });
      context.on('page', newPage => { if (page) operations = operations.then(() => attachPage(newPage)).catch(() => { void end(); }); });
      for (const [index, deposit] of (packet.deposits ?? []).entries()) {
        const url = new URL(deposit.url);
        if (!url.hostname.endsWith('.storage.googleapis.com') && url.hostname !== 'storage.googleapis.com') throw new Error('Deposit storage host invalid');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Deposit could not be staged');
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== deposit.byteSize || createHash('sha256').update(bytes).digest('hex') !== deposit.sha256) throw new Error('Deposit changed');
        const filename = manifest.works[index].title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100) + '_' + index + '.' + deposit.filename.split('.').pop();
        const path = join(temp, filename); await writeFile(path, bytes); stagedFiles.push(path);
      }
      const first = await context.newPage();
      await attachPage(first);
      await first.goto('https://eco.copyright.gov/eService_enu/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }
    send({ type: 'navigation', navigationGeneration: fence.navigationGeneration, viewportVersion: fence.viewportVersion });
  } else if (packet.type === 'client_presence') {
    clientPresent = packet.connected === true;
    if (!clientPresent) { fence.control = 'none'; send({ type: 'control_ack', control: 'none', generation: fence.controlGeneration }); }
  } else if (packet.type === 'control') {
    if (!Number.isSafeInteger(packet.generation) || packet.generation < fence.controlGeneration) return;
    fence.control = 'none'; fence.controlGeneration = packet.generation; fence.lastSequence = 0;
    if (packet.control === 'end') { void end(); return; }
    if (!clientPresent || !context || !page) return;
    if (packet.control === 'agent') {
      if (new URL(page.url()).hostname !== 'eco.copyright.gov') return;
      // Save only reviewed authentication cookies through the isolated vault path.
      send({ type: 'cookies', cookies: await context.cookies('https://eco.copyright.gov') });
    }
    fence.control = packet.control === 'human' ? 'human' : 'agent';
    send({ type: 'control_ack', control: fence.control, generation: fence.controlGeneration });
  } else if (packet.type === 'input') {
    const input = SessionInputSchema.parse(packet.input);
    if (!clientPresent || !cdp || !acceptHumanInput(fence, input)) return;
    fence.lastSequence = input.sequence; lastActivity = Date.now();
    const e = input.event;
    if (e.type === 'pointer') await cdp.send('Input.dispatchMouseEvent', { type: e.action === 'move' ? 'mouseMoved' : e.action === 'down' ? 'mousePressed' : 'mouseReleased', x: e.x * 1200, y: e.y * 900, button: e.button, clickCount: e.action === 'move' ? 0 : 1 });
    else if (e.type === 'scroll') await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: e.x * 1200, y: e.y * 900, deltaX: e.deltaX, deltaY: e.deltaY });
    else if (e.type === 'text') await cdp.send('Input.insertText', { text: e.text });
    else await cdp.send('Input.dispatchKeyEvent', { type: e.action === 'down' ? 'keyDown' : 'keyUp', key: e.key, code: e.key, windowsVirtualKeyCode: ({ Enter: 13, Tab: 9, Backspace: 8, Delete: 46, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 } as Record<string, number>)[e.key] });
    if (Date.now() - lastActivitySent > 5000) { send({ type: 'activity' }); lastActivitySent = Date.now(); }
  } else if (packet.type === 'action') {
    if (!page || !manifest || !clientPresent || fence.control !== 'agent' || packet.generation !== fence.controlGeneration || commandsSeen.has(packet.commandId)) return;
    commandsSeen.add(packet.commandId);
    try { await executeCopyrightAction(page, manifest, packet.actionId); send({ type: 'action_result', commandId: packet.commandId, success: true }); }
    catch { send({ type: 'action_result', commandId: packet.commandId, success: false }); }
  }
}

async function connectBroker() {
  if (closing) return;
  try {
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(brokerUrl);
    const identityToken = await client.idTokenProvider.fetchIdToken(brokerUrl);
    const url = new URL('/session', brokerUrl); url.protocol = 'wss:';
    socket = new WebSocket(url);
    socket.once('open', () => send({ kind: 'worker', sessionId, ownerUid, executionSecret, executionId, identityToken }));
    socket.on('message', (raw, binary) => {
      if (binary || closing) return;
      // Revocation fences queued work immediately, before awaiting in-flight actions.
      let packet: Record<string, any>;
      try { packet = JSON.parse(raw.toString()); } catch { return; }
      if (packet.type === 'control' || (packet.type === 'client_presence' && !packet.connected)) fence.control = 'none';
      operations = operations.then(() => handle(packet)).catch(() => { fence.control = 'none'; send({ type: 'error', code: 'BROWSER_OPERATION_FAILED' }); });
    });
    socket.on('close', () => { fence.control = 'none'; clientPresent = false; if (!closing) setTimeout(() => { void connectBroker(); }, 3000); });
    socket.on('error', () => socket.close());
  } catch { if (!closing) setTimeout(() => { void connectBroker(); }, 5000); }
}
const expiry = setInterval(() => { if (Date.now() >= expiresAtMs || Date.now() - lastActivity > RIGHTS_LIMITS.idleMs) { clearInterval(expiry); void end(); } }, 5000);
process.on('SIGTERM', () => { clearInterval(expiry); void end(); });
await connectBroker();
