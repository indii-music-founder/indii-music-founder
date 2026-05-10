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
      (req as any).user = decodedToken;
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Requires indii.music admin identity' });
    }
  } catch (error) {
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
