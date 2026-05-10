import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-dashboard-backend' });
});

// Placeholder for Google Workspace / Nexus Monitor API routes
app.get('/api/dns/status', (req, res) => {
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
