const fetch = require('node-fetch');

async function test() {
  try {
    // 1. Sign in via Auth Emulator REST API to get ID token
    const authRes = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key', {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wiil@indii.music', password: 'password123', returnSecureToken: true })
    });
    const authData = await authRes.json();
    const idToken = authData.idToken;

    // 2. Call enforceOperationCost with the token
    const res = await fetch('http://127.0.0.1:5001/indii-music-founder/us-central1/enforceOperationCost', {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ data: { operationType: 'agent_stream', estimatedCost: 0.01 } })
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}
test();
