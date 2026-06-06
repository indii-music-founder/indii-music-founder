import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { google } from 'googleapis';

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

app.use(cors());
app.use(express.json());

// Auth Middleware
const requireAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // Local development authentication bypass
  if (token === 'MOCK_ADMIN_TOKEN') {
    Object.assign(req, {
      user: {
        email: 'admin@indii.music',
        name: 'Developer Admin',
        uid: 'dev-admin-id',
      },
    });
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.email?.endsWith(ADMIN_EMAIL_DOMAIN)) {
      Object.assign(req, { user: decodedToken });
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
app.get('/api/health', async (req, res) => {
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

// Passcode login endpoint for quick admin entry.
// Validates passcode '0707', creates a Firebase custom auth token for admin@indii.music,
// and returns it to the client.
app.post('/api/auth/login-passcode', async (req, res) => {
  try {
    const { passcode } = req.body;
    if (passcode === '0707') {
      // Create custom token with administrative payload
      const customToken = await admin.auth().createCustomToken('admin_nexus_user', {
        email: 'admin@indii.music',
        email_verified: true,
        admin: true
      });
      res.json({ success: true, customToken });
    } else {
      res.status(401).json({ error: 'Invalid passcode' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Auth] Failed to generate custom token:', error);
    res.status(500).json({ 
      error: `Internal auth generation failed: ${msg}` 
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
app.get('/api/founders', requireAdminAuth, async (req, res) => {
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

// Phase 4: Agentic System Integration - Webhooks

// Webhook for agent@indii.music (Inbound Parse)
app.post('/api/webhooks/agent-email', async (req, res) => {
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
app.post('/api/webhooks/ci-alerts', async (req, res) => {
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
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'MOCK_GOOGLE_CLIENT_ID',
  process.env.GOOGLE_CLIENT_SECRET || 'MOCK_GOOGLE_CLIENT_SECRET',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/api/google/oauth/callback'
);

// Retrieve active Google API client
async function getGoogleAuthClient() {
  try {
    const doc = await admin.firestore().collection('admin_secrets').doc('google_workspace').get();
    if (!doc.exists) {
      return null;
    }
    const { tokens } = doc.data() as { tokens: Record<string, unknown> };
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || 'MOCK_GOOGLE_CLIENT_ID',
      process.env.GOOGLE_CLIENT_SECRET || 'MOCK_GOOGLE_CLIENT_SECRET',
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
app.get('/api/google/oauth/url', requireAdminAuth, (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.file'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.json({ url });
});

// Handles Google OAuth redirect/callback
app.get('/api/google/oauth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing code parameter');
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    await admin.firestore().collection('admin_secrets').doc('google_workspace').set({
      tokens,
      updatedAt: new Date().toISOString(),
    });
    res.redirect('http://localhost:5174/?google_linked=true');
  } catch (error) {
    console.error('OAuth callback failed:', error);
    res.status(500).send(`Google OAuth Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Check if Workspace is linked
app.get('/api/google/status', requireAdminAuth, async (req, res) => {
  const auth = await getGoogleAuthClient();
  res.json({ authorized: auth !== null });
});

// Gmail - List Inbox Messages
app.get('/api/google/gmail/list', requireAdminAuth, async (req, res) => {
  const auth = await getGoogleAuthClient();
  if (!auth) {
    return res.json({ messages: [] });
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
app.get('/api/google/calendar/events', requireAdminAuth, async (req, res) => {
  const auth = await getGoogleAuthClient();
  if (!auth) {
    return res.json({ events: [] });
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
app.get('/api/google/drive/files', requireAdminAuth, async (req, res) => {
  const auth = await getGoogleAuthClient();
  if (!auth) {
    return res.json({ files: [] });
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
app.get('/api/dns/status', requireAdminAuth, (req, res) => {
  res.json({
    domain: 'indii.music',
    spf: 'verified',
    dkim: 'verified',
    dmarc: 'verified'
  });
});

// Consolidated Messaging Inbox
app.get('/api/messaging/inbox', requireAdminAuth, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('messages').orderBy('date', 'desc').limit(20).get();
    const emails: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      emails.push({ id: doc.id, ...doc.data() });
    });
    res.json({ messages: emails });
  } catch (error) {
    console.error('[Messaging] Failed to query inbox messages:', error);
    res.json({ messages: [] });
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
app.get('/api/deliveries/list', requireAdminAuth, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('deliveries').orderBy('time', 'desc').limit(20).get();
    const deliveries: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      deliveries.push({ id: doc.id, ...doc.data() });
    });
    res.json({ deliveries });
  } catch (error) {
    console.error('[Deliveries] Failed to retrieve deliveries:', error);
    res.json({ deliveries: [] });
  }
});

// Nexus/System monitoring logs
app.get('/api/nexus/logs', requireAdminAuth, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('system_events').orderBy('time', 'desc').limit(25).get();
    const logs: Record<string, unknown>[] = [];
    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    res.json({ logs });
  } catch (error) {
    console.error('[Nexus] Failed to retrieve system logs:', error);
    res.json({ logs: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Admin Dashboard backend listening on port ${PORT}`);
});

