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

app.listen(PORT, () => {
  console.log(`Admin Dashboard backend listening on port ${PORT}`);
});
