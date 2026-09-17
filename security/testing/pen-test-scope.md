# Penetration Testing Scope & Rules of Engagement

## 1. Scope Target
- Production Web App: `https://indii.music`
- Cloud Functions API: `https://us-central1-indii-music-founder.cloudfunctions.net/*`
- Remote Relay WebSocket: `wss://relay.indii.music/*`
- Meta Webhook Endpoint: `https://instagramwebhook-omromhtbxq-uc.a.run.app`

## 2. Out of Scope
- Denial of service attacks (DDoS) against cloud infrastructure.
- Social engineering / phishing against employees or contractors.
- Physical facility intrusions.
- Direct attacks against Google Cloud or Meta corporate infrastructure.

## 3. Testing Methodology
Testing is conducted against the OWASP Top 10 for Web Applications and API Security Top 10, with special focus on tenant isolation, audio vault signed URL manipulation, and Remote Relay command injection.
