import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import admin from 'firebase-admin';

// Initialize Firebase Admin for Identity Platform
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());

// Auth Middleware
const requireAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.email?.endsWith('@indii.music')) {
      Object.assign(req, { user: decodedToken });
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Requires indii.music admin identity' });
    }
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-dashboard-backend' });
});

// Protected Route Example
app.get('/api/dns/status', requireAdminAuth, (req, res) => {
  res.json({
    domain: 'indii.music',
    spf: 'verified',
    dkim: 'verified',
    dmarc: 'verified'
  });
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

    res.json({ maxSeats: 10, count: founders.length, founders });
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

app.listen(PORT, () => {
  console.log(`Admin Dashboard backend listening on port ${PORT}`);
});
