import { createServer } from 'node:http';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { WebSocket, WebSocketServer } from 'ws';
import type { BoardroomAssignment } from './boardroomControl.js';
import { BoardroomSession } from './boardroomSession.js';

const projectId = process.env.BOARDROOM_FIREBASE_PROJECT_ID;
if (!projectId || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Boardroom browser requires a Firebase project and production token verification.');
}
const auth = getAuth(initializeApp({ projectId }));
const origins = new Set((process.env.BOARDROOM_CLIENT_ORIGINS ?? 'https://app.indii.music,https://indii.music').split(','));
const sessions = new Map<string, WebSocket>();
const maxSessions = 4;
function assignmentFrom(input: unknown): BoardroomAssignment {
  if (!input || typeof input !== 'object') throw new Error('Mission assignment required');
  const { requestId, stepId, agentId } = input as Record<string, unknown>;
  if (typeof requestId !== 'string' || typeof stepId !== 'string' || typeof agentId !== 'string'
      || ![requestId, stepId, agentId].every(id => /^[a-z0-9._:-]{1,128}$/i.test(id))) {
    throw new Error('Invalid mission assignment');
  }
  return { requestId, stepId, agentId };
}

const sockets = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
const server = createServer((request, response) => {
  response.writeHead(request.url === '/healthz' ? 200 : 404).end();
});
server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/boardroom' || !origins.has(request.headers.origin ?? '') || sockets.clients.size >= maxSessions * 2) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, client => sockets.emit('connection', client));
});

sockets.on('connection', socket => {
  let session: BoardroomSession | undefined;
  let owner: string | undefined;
  let busy = false;
  let activeDownload: AbortController | undefined;
  const authTimeout = setTimeout(() => socket.close(1008, 'Sign-in required'), 8000);
  const lifetime = setTimeout(() => socket.close(1000, 'Session expired'), 15 * 60_000);
  const send = (event: object) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  };
  socket.once('close', () => {
    activeDownload?.abort();
    clearTimeout(authTimeout);
    clearTimeout(lifetime);
    const release = () => {
      if (owner && sessions.get(owner) === socket) sessions.delete(owner);
    };
    if (session) void session.close().catch(() => {}).finally(release);
    else release();
  });

  socket.once('message', raw => {
    void (async () => {
      const message = JSON.parse(raw.toString());
      if (message?.type !== 'open' || typeof message.token !== 'string' || typeof message.url !== 'string') {
        throw new Error('Open request required');
      }
      const identity = await auth.verifyIdToken(message.token, true);
      if (identity.firebase.sign_in_provider === 'anonymous' || socket.readyState !== WebSocket.OPEN) {
        throw new Error('Signed-in account required');
      }
      if (sessions.size >= maxSessions || sessions.has(identity.uid)) {
        send({ type: 'error', message: 'A live browser is busy or already open. Close it and retry.' });
        socket.close(1008);
        return;
      }
      owner = identity.uid;
      sessions.set(owner, socket);
      clearTimeout(authTimeout);
      session = await BoardroomSession.open(process.env.CHROME_BIN);
      if (socket.readyState !== WebSocket.OPEN) {
        await session.close();
        return;
      }

      const active = session;
      const sendFrame = async () => {
        const state = active.control.state;
        const url = active.url;
        const frame = await active.frame();
        if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 1024 * 1024) return;
        if (state.navigationGeneration !== active.control.state.navigationGeneration || url !== active.url) return;
        if (state.controlGeneration !== active.control.state.controlGeneration) return;
        send({ type: 'state', ...state, url });
        socket.send(frame, { binary: true });
      };

      await active.navigateAsArtist(message.url, active.control.state);
      await sendFrame();

      socket.on('message', rawInput => {
        let input;
        try {
          input = JSON.parse(rawInput.toString());
          if (!input || typeof input.type !== 'string') return;
        } catch {
          socket.close(1008, 'Invalid browser request');
          return;
        }
        const reply = (message: object) => send({ ...message, requestId: input.requestId });
        // Revocation must fence an in-flight specialist read even while the page is busy.
        if (input.type === 'takeover') {
          activeDownload?.abort();
          active.control.takeOver();
          send({ type: 'state', ...active.control.state, url: active.url });
          if (!busy) send({ type: 'ready' });
          return;
        }
        if (busy) {
          reply({ type: 'error', message: 'Wait for the current browser action to finish.' });
          return;
        }
        busy = true;
        void (async () => {
          const { controlGeneration, navigationGeneration } = input;
          const version = { controlGeneration, navigationGeneration };
          switch (input.type) {
            case 'grant':
              if (!active.control.giveControl(assignmentFrom(input.assignment), version)) {
                throw new Error('The page or browser owner changed.');
              }
              break;
            case 'specialist_read': {
              const assignment = assignmentFrom(input.assignment);
              let page = await active.readAsSpecialist(assignment, version);
              if (typeof input.url !== 'string') throw new Error('A public address is required.');
              const requestedUrl = new URL(input.url).href;
              const spotifyHome = requestedUrl === 'https://artists.spotify.com/'
                && page.url === 'https://artists.spotify.com/home';
              if (requestedUrl !== page.url && !spotifyHome) {
                await active.followAsSpecialist(requestedUrl, assignment, version);
                page = await active.readAsSpecialist(assignment, active.control.state);
              }
              reply({ type: 'specialist_result', page });
              break;
            }
            case 'specialist_download_font': {
              if (typeof input.family !== 'string' || typeof input.requestId !== 'string') {
                throw new Error('A font family and request are required.');
              }
              activeDownload = new AbortController();
              try {
                const result = await active.downloadFontAsSpecialist(
                  input.family, assignmentFrom(input.assignment), version, activeDownload.signal,
                );
                if (socket.readyState !== WebSocket.OPEN || activeDownload.signal.aborted) return;
                reply({ type: 'specialist_font', filename: result.filename, size: result.bytes.byteLength });
                socket.send(result.bytes, { binary: true });
              } finally {
                activeDownload = undefined;
              }
              break;
            }
            case 'navigate': await active.navigateAsArtist(input.url, version); break;
            case 'back':
            case 'forward':
            case 'reload': await active.historyAsArtist(input.type, version); break;
            case 'click': await active.clickAsArtist(input.x, input.y, version); break;
            case 'scroll': await active.scrollAsArtist(input.x, input.y, version); break;
            case 'key': await active.keyAsArtist(input.key, version); break;
            case 'text': await active.typeAsArtist(input.text, version); break;
            case 'capture': {
              const page = await active.captureAsArtist(version);
              send({ type: 'capture', page });
              break;
            }
            default: throw new Error('Unsupported browser operation');
          }
          await sendFrame();
        })().catch(async () => {
          reply({ type: 'error', message: 'The browser could not complete that action. Check the displayed page and who has control.' });
          await sendFrame().catch(() => {});
        }).finally(() => {
          busy = false;
          send({ type: 'ready' });
        });
      });
      send({ type: 'ready' });
    })().catch(() => {
      send({ type: 'error', message: 'Could not start the live browser. Check sign-in and the address.' });
      socket.close(1008);
    });
  });
  socket.on('error', () => socket.terminate());
});

server.listen(Number(process.env.PORT ?? 8080));
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close();
    for (const socket of sockets.clients) socket.terminate();
  });
}
