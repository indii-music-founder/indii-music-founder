import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { google } from 'googleapis';
import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const ADMIN_EMAIL_DOMAIN = '@indii.music';

// Initialize Firebase Admin for Identity Platform + Firestore reads.
//
// Uses Application Default Credentials. Locally, the simplest path is:
//   gcloud auth application-default login
// or point GOOGLE_APPLICATION_CREDENTIALS at a service-account JSON. In a GCP
// runtime (Cloud Run, etc.) ADC is provided automatically.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || 'indii-music-founder',
    });
  } catch (err) {
    console.error(
      '\n[Admin] Could not initialize Firebase Admin credentials.\n' +
      'Run one of:\n' +
      '  • gcloud auth application-default login\n' +
      '  • export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json\n',
      err
    );
  }
}

const app = express();
const PORT = process.env.PORT || 3333;

// CORS is deny-by-default. In production the dashboard is served as static
// assets by this same process (same origin, no CORS needed); in dev Vite proxies
// /api from :4173-style ports, also same origin. Any additional browser origin
// must be named explicitly via ADMIN_ALLOWED_ORIGINS (comma-separated). An
// unrestricted `cors()` here would let any site on the internet drive the admin
// API with a victim admin's credentials.
const allowedOrigins = (process.env.ADMIN_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = same-origin or a non-browser client (curl, server-to-server).
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());

// ─── Access Audit ────────────────────────────────────────────────────────────
// The founder requires a durable record of who entered the dashboard and when
// (and, with future employees, exactly which identity did what). Every admitted
// request refreshes that identity's audit trail. Writes are throttled to one
// entry per ACCESS_AUDIT_INTERVAL_MS per user so dashboard polling does not
// flood the log, and an audit failure must never block or break a request.

const ACCESS_LOG_COLLECTION = 'admin_access_log';
const ACCESS_AUDIT_STATE_COLLECTION = 'admin_access_state';
const ACCESS_AUDIT_INTERVAL_MS = 30 * 60 * 1000;
const lastAuditWriteAt = new Map<string, number>();

const recordAccess = (req: express.Request, decodedToken: admin.auth.DecodedIdToken): void => {
  try {
    const now = Date.now();
    const last = lastAuditWriteAt.get(decodedToken.uid) ?? 0;
    if (now - last < ACCESS_AUDIT_INTERVAL_MS) return;
    lastAuditWriteAt.set(decodedToken.uid, now);

    const at: admin.firestore.FieldValue | Date = admin.firestore.FieldValue
      ? admin.firestore.FieldValue.serverTimestamp()
      : new Date(); // fallback when the admin SDK stub lacks FieldValue (tests)
    const entry = {
      uid: decodedToken.uid,
      email: decodedToken.email ?? 'unknown',
      ip: req.ip ?? 'unknown',
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'unknown',
      at,
    };

    // Inside one async fn so ANY failure — including synchronous throws from a
    // misshaped Firestore handle — becomes an ordinary caught rejection instead
    // of an orphaned unhandled rejection escaping around Promise.all setup.
    const writeAuditTrail = async (): Promise<void> => {
      const db = admin.firestore();
      await db.collection(ACCESS_LOG_COLLECTION).add(entry);
      await db.collection(ACCESS_AUDIT_STATE_COLLECTION).doc(decodedToken.uid).set({
        email: entry.email,
        lastSeenAt: entry.at,
        lastIp: entry.ip,
        lastUserAgent: entry.userAgent,
      }, { merge: true });
    };
    void writeAuditTrail().catch((err: unknown) => {
      console.error('[Admin] Access audit write failed:', err);
    });
  } catch (err) {
    console.error('[Admin] Access audit failed:', err);
  }
};

// Auth Middleware
const requireAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.email?.endsWith(ADMIN_EMAIL_DOMAIN)) {
      Object.assign(req, { user: decodedToken });
      recordAccess(req, decodedToken);
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Requires indii.music admin identity' });
    }
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check — also verifies Firestore connectivity so a missing/invalid
// credential surfaces immediately instead of failing later inside a data route.
app.get('/api/health', async (_req, res) => {
  try {
    await admin.firestore().collection('user_usage_stats').limit(1).get();
    res.json({ status: 'ok', service: 'admin-dashboard-backend', firestore: 'connected' });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      service: 'admin-dashboard-backend',
      firestore: 'unreachable',
      hint: 'Run `gcloud auth application-default login` or set GOOGLE_APPLICATION_CREDENTIALS.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── Token Usage / AI Cost ───────────────────────────────────────────────────
// Serves REAL per-user AI spend aggregated from the `user_usage_stats` Firestore
// collection (written by TokenUsageService.trackUsage). No mock data — if there is
// no usage in the window, the response is an honest empty summary.

interface ModelTotal {
  model: string;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  costUsd: number;
}

interface UserTotal {
  userId: string;
  tokensUsed: number;
  requestCount: number;
  costUsd: number;
}

/** Default the range to the last 30 days (inclusive) when not supplied. */
function resolveRange(startRaw?: string, endRaw?: string): { start: string; end: string } {
  const isYmd = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const today = new Date();
  const end = isYmd(endRaw) ? endRaw : today.toISOString().split('T')[0];
  const startDefault = new Date(today);
  startDefault.setUTCDate(startDefault.getUTCDate() - 29);
  const start = isYmd(startRaw) ? startRaw : startDefault.toISOString().split('T')[0];
  return { start, end };
}

app.get('/api/usage/summary', requireAdminAuth, async (req, res) => {
  try {
    const { start, end } = resolveRange(
      typeof req.query.start === 'string' ? req.query.start : undefined,
      typeof req.query.end === 'string' ? req.query.end : undefined
    );

    const snapshot = await admin
      .firestore()
      .collection('user_usage_stats')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();

    const byModel = new Map<string, ModelTotal>();
    const byUser = new Map<string, UserTotal>();
    let totalCostUsd = 0;
    let totalTokens = 0;
    let totalRequests = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as {
        userId?: string;
        tokensUsed?: number;
        requestCount?: number;
        estimatedCostUsd?: number;
        models?: Record<string, ModelTotal>;
      };

      const tokens = data.tokensUsed || 0;
      const requests = data.requestCount || 0;
      const cost = data.estimatedCostUsd || 0;
      totalTokens += tokens;
      totalRequests += requests;
      totalCostUsd += cost;

      const userId = data.userId || 'unknown';
      const user = byUser.get(userId) || { userId, tokensUsed: 0, requestCount: 0, costUsd: 0 };
      user.tokensUsed += tokens;
      user.requestCount += requests;
      user.costUsd += cost;
      byUser.set(userId, user);

      for (const m of Object.values(data.models || {})) {
        const existing = byModel.get(m.model) || {
          model: m.model,
          inputTokens: 0,
          outputTokens: 0,
          requestCount: 0,
          costUsd: 0
        };
        existing.inputTokens += m.inputTokens || 0;
        existing.outputTokens += m.outputTokens || 0;
        existing.requestCount += m.requestCount || 0;
        existing.costUsd += m.costUsd || 0;
        byModel.set(m.model, existing);
      }
    });

    const activeUsers = byUser.size;
    const averageCostPerUserUsd = activeUsers > 0 ? totalCostUsd / activeUsers : 0;

    res.json({
      start,
      end,
      totalCostUsd,
      totalTokens,
      totalRequests,
      activeUsers,
      averageCostPerUserUsd,
      byModel: Array.from(byModel.values()).sort((a, b) => b.costUsd - a.costUsd),
      byUser: Array.from(byUser.values()).sort((a, b) => b.costUsd - a.costUsd)
    });
  } catch (error) {
    console.error('[Usage] Failed to aggregate user_usage_stats:', error);
    res.status(500).json({ error: 'Failed to load usage data' });
  }
});

// ─── Founders ─────────────────────────────────────────────────────────────────
// Serves the REAL founders roster from the `founders` Firestore collection
// (written by activateFounderPass). Empty array when no founders have activated yet —
// never invented names.
app.get('/api/founders', requireAdminAuth, async (_req, res) => {
  try {
    const snapshot = await admin
      .firestore()
      .collection('founders')
      .orderBy('seat', 'asc')
      .get();

    const founders = snapshot.docs.map((d) => {
      const f = d.data() as {
        seat?: number;
        name?: string;
        joinedAt?: string;
        uid?: string;
        agreementVersion?: string;
      };
      return {
        seat: f.seat ?? null,
        name: f.name ?? 'Unknown',
        joinedAt: f.joinedAt ?? null,
        uid: f.uid ?? d.id,
        agreementVersion: f.agreementVersion ?? null,
      };
    });

    res.json({ maxSeats: 11, count: founders.length, founders });
  } catch (error) {
    console.error('[Founders] Failed to read founders collection:', error);
    res.status(500).json({ error: 'Failed to load founders' });
  }
});

// Serves both the canonical verified Founding Artist queue and the legacy raw
// landing submissions. Canonical records win during deduplication; raw records
// remain labelled legacy_unverified until their owner completes email-link auth.
app.get('/api/waitlist', requireAdminAuth, async (_req, res) => {
  try {
    const firestore = admin.firestore();
    const [verifiedSnapshot, legacySnapshot] = await Promise.all([
      firestore.collection('foundingArtistWaitlist').orderBy('queuePosition', 'asc').limit(1000).get(),
      firestore.collection('waitlist').orderBy('createdAt', 'asc').limit(1000).get(),
    ]);

    const byEmail = new Map<string, {
      id: string;
      email: string;
      joinedAt: string | null;
      source: string;
      submissionCount: number;
      submissionOrder: number;
      verificationStatus: 'verified' | 'unverified';
      status: 'waitlisted' | 'invited' | 'accepted' | 'declined' | 'revoked' | 'legacy_unverified';
    }>();

    const toIso = (value: unknown): string | null => {
      try {
        const date = typeof value === 'object' && value !== null && 'toDate' in value
          ? (value as { toDate?: () => Date }).toDate?.()
          : value instanceof Date
            ? value
            : typeof value === 'string'
              ? new Date(value)
              : null;
        return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
      } catch {
        return null;
      }
    };

    for (const document of verifiedSnapshot.docs) {
      const data = document.data() as {
        email?: unknown;
        joinedAt?: unknown;
        source?: unknown;
        queuePosition?: unknown;
        status?: unknown;
      };
      if (typeof data.email !== 'string') continue;
      const email = data.email.trim().toLowerCase();
      const position = typeof data.queuePosition === 'number' ? data.queuePosition : 0;
      const allowedStatuses = ['waitlisted', 'invited', 'accepted', 'declined', 'revoked'] as const;
      const status = allowedStatuses.includes(data.status as typeof allowedStatuses[number])
        ? data.status as typeof allowedStatuses[number]
        : 'waitlisted';
      byEmail.set(email, {
        id: `verified:${document.id}`,
        email,
        joinedAt: toIso(data.joinedAt),
        source: typeof data.source === 'string' ? data.source : 'unknown',
        submissionCount: 1,
        submissionOrder: position,
        verificationStatus: 'verified',
        status,
      });
    }

    let legacyPosition = 0;
    for (const document of legacySnapshot.docs) {
      const data = document.data() as {
        email?: unknown;
        createdAt?: unknown;
        source?: unknown;
      };
      if (typeof data.email !== 'string') continue;

      const email = data.email.trim().toLowerCase();
      if (!email) continue;
      legacyPosition += 1;

      const existing = byEmail.get(email);
      if (existing) {
        if (existing.verificationStatus === 'unverified') existing.submissionCount += 1;
        continue;
      }

      byEmail.set(email, {
        id: `legacy:${document.id}`,
        email,
        joinedAt: toIso(data.createdAt),
        source: typeof data.source === 'string' ? data.source : 'unknown',
        submissionCount: 1,
        submissionOrder: legacyPosition,
        verificationStatus: 'unverified',
        status: 'legacy_unverified',
      });
    }

    const entries = Array.from(byEmail.values()).sort((a, b) => {
      if (a.verificationStatus !== b.verificationStatus) return a.verificationStatus === 'verified' ? -1 : 1;
      return a.submissionOrder - b.submissionOrder;
    });
    const verifiedCount = entries.filter((entry) => entry.verificationStatus === 'verified').length;

    res.json({
      count: entries.length,
      totalSubmissions: verifiedSnapshot.docs.length + legacySnapshot.docs.length,
      verifiedCount,
      unverifiedCount: entries.length - verifiedCount,
      verificationEnabled: true,
      entries,
    });
  } catch (error) {
    console.error('[Waitlist] Failed to read waitlist collection:', error);
    res.status(500).json({ error: 'Failed to load waitlist' });
  }
});

// Phase 4: Agentic System Integration - Webhooks

const requireWebhookSecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Webhooks] Webhook secret not configured. Failing closed.');
    return res.status(500).send('Server configuration error');
  }
  const token = req.headers['x-webhook-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== secret) {
    console.warn('[Webhooks] Rejected request: invalid secret token');
    return res.status(401).send('Unauthorized');
  }
  next();
};

// Webhook for agent@indii.music (Inbound Parse)
app.post('/api/webhooks/agent-email', requireWebhookSecret, async (req, res) => {
  try {
    const emailPayload = req.body;
    console.log(`[Agent Nexus] Received email for agent@indii.music from ${emailPayload.from}`);
    // Here we would route the email payload to the appropriate LangChain/Genkit agent
    res.status(200).send('Agent payload received and queued for processing.');
  } catch (error) {
    console.error('Error processing agent email webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Webhook for Blacksmith.sh / GitHub Actions CI Failures
app.post('/api/webhooks/ci-alerts', requireWebhookSecret, async (req, res) => {
  try {
    const alertPayload = req.body;
    console.log(`[Agent Nexus] Received CI Alert for workflow: ${alertPayload.workflow_run?.name}`);
    
    // Auto-remediation logic: if failure is detected, generate ticket and page developer
    if (alertPayload.action === 'completed' && alertPayload.workflow_run?.conclusion === 'failure') {
      console.log(`[Auto-Remediation] Generating ticket for failed run ${alertPayload.workflow_run.id}`);
      // Integrate with GitHub Issues or Linear here
    }
    
    res.status(200).send('CI alert processed.');
  } catch (error) {
    console.error('Error processing CI alert webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ─── Google Workspace OAuth & API Integration ──────────────────────────────────
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('[Admin] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are missing. Google OAuth will fail.');
}
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
  process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/api/google/oauth/callback'
);

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_COLLECTION = 'admin_oauth_states';

/**
 * Consume an OAuth state exactly once before exchanging the authorization code.
 * The state document is deliberately server-side: the callback cannot carry an
 * admin Firebase token after Google redirects the browser back to this service.
 */
async function consumeOAuthState(state: string): Promise<string | null> {
  const stateRef = admin.firestore().collection(OAUTH_STATE_COLLECTION).doc(state);

  return admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(stateRef);
    const data = snapshot.data() as { adminUid?: string; expiresAt?: number } | undefined;
    if (!snapshot.exists || !data?.adminUid || !data.expiresAt || data.expiresAt < Date.now()) {
      if (snapshot.exists) transaction.delete(stateRef);
      return null;
    }

    transaction.delete(stateRef);
    return data.adminUid;
  });
}

// Retrieve active Google API client
async function getGoogleAuthClient() {
  try {
    const doc = await admin.firestore().collection('admin_secrets').doc('google_workspace').get();
    if (!doc.exists) {
      return null;
    }
    const { tokens } = doc.data() as { tokens: Record<string, unknown> };
    // Real credentials only — startup already throws if these are unset.
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/api/google/oauth/callback'
    );
    auth.setCredentials(tokens);
    return auth;
  } catch (error) {
    console.error('Error fetching Google credentials:', error);
    return null;
  }
}

// Generate OAuth Consent URL
app.get('/api/google/oauth/url', requireAdminAuth, async (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.file'
  ];
  const user = (req as express.Request & { user?: admin.auth.DecodedIdToken }).user;
  if (!user?.uid) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const state = randomBytes(32).toString('base64url');
    await admin.firestore().collection(OAUTH_STATE_COLLECTION).doc(state).create({
      adminUid: user.uid,
      createdAt: Date.now(),
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
    });
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
    });
    res.json({ url });
  } catch (error) {
    console.error('Failed to create OAuth state:', error);
    res.status(500).json({ error: 'Failed to start Google OAuth flow' });
  }
});

// Handles Google OAuth redirect/callback
app.get('/api/google/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    return res.status(400).send('Missing or invalid OAuth callback parameters');
  }
  try {
    const initiatingAdminUid = await consumeOAuthState(state);
    if (!initiatingAdminUid) {
      return res.status(401).send('Invalid or expired OAuth state');
    }
    const { tokens } = await oauth2Client.getToken(code);
    await admin.firestore().collection('admin_secrets').doc('google_workspace').set({
      tokens,
      linkedBy: initiatingAdminUid,
      updatedAt: new Date().toISOString(),
    });
    // Relative redirect resolves against whichever origin served the dashboard
    // (same-origin static in production, the Vite proxy in local dev).
    res.redirect('/?google_linked=true');
  } catch (error) {
    console.error('OAuth callback failed:', error);
    // Generic body on a public route — internal error text is recon fodder.
    res.status(500).send('Google OAuth authentication failed.');
  }
});

// Check if Workspace is linked
app.get('/api/google/status', requireAdminAuth, async (_req, res) => {
  const auth = await getGoogleAuthClient();
  res.json({ authorized: auth !== null });
});

// Gmail - List Inbox Messages
app.get('/api/google/gmail/list', requireAdminAuth, async (_req, res) => {
  const auth = await getGoogleAuthClient();
  if (!auth) {
    // Not an empty result — the Workspace was never linked. Say so explicitly so
    // the client renders its connect prompt instead of "you have no mail".
    return res.status(412).json({ error: 'Google Workspace account is not connected', code: 'workspace_not_linked' });
  }
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const response = await gmail.users.messages.list({ userId: 'me', maxResults: 10 });
    const messages = response.data.messages || [];
    const detailedMessages = await Promise.all(
      messages.map(async (m) => {
        const detail = await gmail.users.messages.get({ userId: 'me', id: m.id! });
        const headers = detail.data.payload?.headers || [];
        const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Unknown';
        const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || 'No Subject';
        const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || new Date().toISOString();
        return {
          id: m.id!,
          from,
          subject,
          snippet: detail.data.snippet || '',
          date: new Date(date).toISOString(),
          isAiDraft: false,
        };
      })
    );
    res.json({ messages: detailedMessages });
  } catch (error) {
    console.error('Gmail API list failed:', error);
    res.status(500).json({ error: 'Failed to retrieve Gmail inbox', details: String(error) });
  }
});

// Gmail - Send Message
app.post('/api/google/gmail/send', requireAdminAuth, async (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing recipient, subject, or body' });
  }
  const auth = await getGoogleAuthClient();
  if (!auth) {
    return res.status(412).json({ error: 'Google Workspace account is not connected' });
  }
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      body,
    ];
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Gmail API send failed:', error);
    res.status(500).json({ error: 'Failed to send email via Gmail', details: String(error) });
  }
});

// Calendar - Fetch Events
app.get('/api/google/calendar/events', requireAdminAuth, async (_req, res) => {
  const auth = await getGoogleAuthClient();
  if (!auth) {
    // Not an empty result — the Workspace was never linked. Say so explicitly so
    // the client renders its connect prompt instead of "you have no mail".
    return res.status(412).json({ error: 'Google Workspace account is not connected', code: 'workspace_not_linked' });
  }
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 15,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = (response.data.items || []).map((e) => ({
      id: e.id!,
      title: e.summary || 'Untitled Event',
      start: e.start?.dateTime || e.start?.date || new Date().toISOString(),
      end: e.end?.dateTime || e.end?.date || new Date().toISOString(),
      description: e.description || '',
    }));
    res.json({ events });
  } catch (error) {
    console.error('Calendar API list failed:', error);
    res.status(500).json({ error: 'Failed to retrieve calendar events', details: String(error) });
  }
});

// Calendar - Insert Event
app.post('/api/google/calendar/events/create', requireAdminAuth, async (req, res) => {
  const { title, start, end, description } = req.body;
  if (!title || !start || !end) {
    return res.status(400).json({ error: 'Missing title, start, or end time' });
  }
  const auth = await getGoogleAuthClient();
  if (!auth) {
    return res.status(412).json({ error: 'Google Workspace account is not connected' });
  }
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        description: description || '',
        start: { dateTime: start },
        end: { dateTime: end },
      },
    });
    res.json({ success: true, eventId: response.data.id });
  } catch (error) {
    console.error('Calendar API create failed:', error);
    res.status(500).json({ error: 'Failed to create calendar event', details: String(error) });
  }
});

// Drive - List Files
app.get('/api/google/drive/files', requireAdminAuth, async (_req, res) => {
  const auth = await getGoogleAuthClient();
  if (!auth) {
    // Not an empty result — the Workspace was never linked. Say so explicitly so
    // the client renders its connect prompt instead of "you have no mail".
    return res.status(412).json({ error: 'Google Workspace account is not connected', code: 'workspace_not_linked' });
  }
  try {
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      pageSize: 20,
      fields: 'files(id, name, mimeType, size, modifiedTime)',
      orderBy: 'modifiedTime desc',
    });
    const files = (response.data.files || []).map((f) => ({
      id: f.id!,
      name: f.name || 'Unnamed File',
      mimeType: f.mimeType || 'unknown',
      size: f.size ? `${(parseInt(f.size) / (1024 * 1024)).toFixed(1)} MB` : 'N/A',
      modifiedTime: f.modifiedTime || new Date().toISOString(),
    }));
    res.json({ files });
  } catch (error) {
    console.error('Drive API list failed:', error);
    res.status(500).json({ error: 'Failed to retrieve Drive files', details: String(error) });
  }
});

// Drive - Upload File
app.post('/api/google/drive/upload', requireAdminAuth, async (req, res) => {
  const { name, content, mimeType } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: 'Missing name or content' });
  }
  const auth = await getGoogleAuthClient();
  if (!auth) {
    return res.status(412).json({ error: 'Google Workspace account is not connected' });
  }
  try {
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: mimeType || 'text/plain',
      },
      media: {
        mimeType: mimeType || 'text/plain',
        body: content,
      },
    });
    res.json({ success: true, fileId: response.data.id });
  } catch (error) {
    console.error('Drive API upload failed:', error);
    res.status(500).json({ error: 'Failed to upload file to Drive', details: String(error) });
  }
});

// Protected Route for DNS Status
app.get('/api/dns/status', requireAdminAuth, async (_req, res) => {
  try {
    const domain = 'indii.music';
    
    let spf = 'unverified';
    let dkim = 'unverified';
    let dmarc = 'unverified';

    try {
      const txtRecords = await dns.resolveTxt(domain);
      // txtRecords is an array of arrays of strings
      const hasSpf = txtRecords.some((record: string[]) => record.join('').includes('v=spf1'));
      if (hasSpf) spf = 'verified';
    } catch (e) { console.error('SPF lookup failed:', e); }

    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
      const hasDmarc = dmarcRecords.some((record: string[]) => record.join('').includes('v=DMARC1'));
      if (hasDmarc) dmarc = 'verified';
    } catch (e) { console.error('DMARC lookup failed:', e); }

    try {
      // Assuming 'google' selector based on workspace integration, 
      // but if others exist they might be needed. We'll check google.
      const dkimRecords = await dns.resolveTxt(`google._domainkey.${domain}`);
      const hasDkim = dkimRecords.some((record: string[]) => record.join('').includes('v=DKIM1'));
      if (hasDkim) dkim = 'verified';
    } catch (e) { console.error('DKIM lookup failed:', e); }

    res.json({
      domain,
      spf,
      dkim,
      dmarc,
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve DNS status', details: String(error) });
  }
});

// Consolidated Messaging Inbox
app.get('/api/messaging/inbox', requireAdminAuth, async (_req, res) => {
  try {
    const snapshot = await admin.firestore().collection('messages').orderBy('date', 'desc').limit(20).get();
    const emails: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      emails.push({ id: doc.id, ...doc.data() });
    });
    res.json({ messages: emails });
  } catch (error) {
    // Never answer 200-with-empty on failure: the UI cannot tell a real empty
    // inbox from a broken backend, and would render "no messages" for an outage.
    console.error('[Messaging] Failed to query inbox messages:', error);
    res.status(500).json({ error: 'Failed to query inbox messages' });
  }
});

// Approve AI Agent composed draft
app.post('/api/messaging/approve-draft', requireAdminAuth, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing draft id' });
  
  try {
    const docRef = admin.firestore().collection('messages').doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      await docRef.update({ isAiDraft: false, approvedAt: new Date().toISOString() });
      return res.json({ success: true, message: 'Draft approved and queued for dispatch' });
    }
    
    res.status(404).json({ error: 'Draft message not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve draft message', details: String(error) });
  }
});

// Live deliveries list
app.get('/api/deliveries/list', requireAdminAuth, async (_req, res) => {
  try {
    const snapshot = await admin.firestore().collection('deliveries').orderBy('time', 'desc').limit(20).get();
    const deliveries: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      deliveries.push({ id: doc.id, ...doc.data() });
    });
    res.json({ deliveries });
  } catch (error) {
    console.error('[Deliveries] Failed to retrieve deliveries:', error);
    res.status(500).json({ error: 'Failed to retrieve deliveries' });
  }
});

// Nexus/System monitoring logs
app.get('/api/nexus/logs', requireAdminAuth, async (_req, res) => {
  try {
    const snapshot = await admin.firestore().collection('system_events').orderBy('time', 'desc').limit(25).get();
    const logs: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    res.json({ logs });
  } catch (error) {
    console.error('[Nexus] Failed to retrieve system logs:', error);
    res.status(500).json({ error: 'Failed to retrieve system logs' });
  }
});

// Access audit — who has been in the dashboard, newest first. Admin-only like
// every other data route: the log itself must not leak to non-admin identities.
app.get('/api/admin/access-log', requireAdminAuth, async (_req, res) => {
  try {
    const snapshot = await admin.firestore()
      .collection(ACCESS_LOG_COLLECTION)
      .orderBy('at', 'desc')
      .limit(100)
      .get();
    const entries: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() });
    });
    res.json({ entries });
  } catch (error) {
    console.error('[Admin] Failed to retrieve access log:', error);
    res.status(500).json({ error: 'Failed to retrieve access log' });
  }
});

// Serve the frontend for any non-API routes
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

// Only bind a real port when this file is the process entry point — not when a
// test imports `app` to drive it via an ephemeral in-process listener.
if (process.argv[1] === __filename) {
  app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Admin Dashboard backend listening on port ${PORT}`);
  });
}

export { app, resolveRange };
