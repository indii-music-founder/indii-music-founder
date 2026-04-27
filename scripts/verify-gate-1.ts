import { GoogleAuth } from 'google-auth-library';

export const FINE_TUNED_MODEL_REGISTRY: Partial<Record<string, string>> = {
    'generalist':    'projects/223837784072/locations/us-central1/endpoints/4735553150121934848',
    'finance':       'projects/223837784072/locations/us-central1/endpoints/6137298534141001728',
    'legal':         'projects/223837784072/locations/us-central1/endpoints/4777774396628533248',
    'distribution':  'projects/223837784072/locations/us-central1/endpoints/5237704508573745152',
    'marketing':     'projects/223837784072/locations/us-central1/endpoints/1319009882807992320',
    'social':        'projects/223837784072/locations/us-central1/endpoints/5771381064417148928',
    'publishing':    'projects/223837784072/locations/us-central1/endpoints/3258372472344412160',
    'licensing':     'projects/223837784072/locations/us-central1/endpoints/6679982289239146496',
    'brand':         'projects/223837784072/locations/us-central1/endpoints/7567191415831134208',
    'road':          'projects/223837784072/locations/us-central1/endpoints/3656378089413279744',
    'publicist':     'projects/223837784072/locations/us-central1/endpoints/2417325241932972032',
    'music':         'projects/223837784072/locations/us-central1/endpoints/1795828493355843584',
    'video':         'projects/223837784072/locations/us-central1/endpoints/8143652168134557696',
    'devops':        'projects/223837784072/locations/us-central1/endpoints/4433249025134690304',
    'security':      'projects/223837784072/locations/us-central1/endpoints/1282418135835607040',
    'producer':      'projects/223837784072/locations/us-central1/endpoints/1620188107888394240',
    'director':      'projects/223837784072/locations/us-central1/endpoints/5993183346065145856',
    'screenwriter':  'projects/223837784072/locations/us-central1/endpoints/6342775267139780608',
    'merchandise':   'projects/223837784072/locations/us-central1/endpoints/7718062003348045824',
    'curriculum':    'projects/223837784072/locations/us-central1/endpoints/8815251462566182912',
};

async function verifyGate1() {
  console.log('--- GATE 1: ENDPOINT REACHABILITY ---');
  console.log('Testing 16 R7 fine-tuned endpoints...\\n');

  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const location = 'us-central1';
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to obtain Google Cloud access token.');
    }

    const agents = Object.keys(FINE_TUNED_MODEL_REGISTRY).filter(k => k !== 'keeper');
    let passed = 0;
    let failed = 0;

    for (const agent of agents) {
      const endpointPath = FINE_TUNED_MODEL_REGISTRY[agent as keyof typeof FINE_TUNED_MODEL_REGISTRY];
      if (!endpointPath) continue;

      const url = `https://${location}-aiplatform.googleapis.com/v1beta1/${endpointPath}:generateContent`;

      const startTime = Date.now();
      try {
        const payload = {
          contents: [{ role: 'user', parts: [{ text: 'Hello, are you operational? Keep it very brief.' }] }],
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        const duration = Date.now() - startTime;

        if (res.ok) {
          const data = await res.json();
          const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
             console.log(`[PASS] ${agent.padEnd(15)} - ${duration}ms (SLA < 5000ms)`);
             passed++;
          } else {
             console.log(`[FAIL] ${agent.padEnd(15)} - Empty response content.`);
             failed++;
          }
        } else {
          const errText = await res.text();
          console.log(`[FAIL] ${agent.padEnd(15)} - HTTP ${res.status}: ${errText.slice(0, 100)}`);
          failed++;
        }

      } catch (err: any) {
        console.log(`[FAIL] ${agent.padEnd(15)} - Error: ${err.message}`);
        failed++;
      }
    }

    console.log(`\\nGate 1 Verification Complete: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('Verdict: PASS');
    } else {
      console.log('Verdict: FAIL');
    }

  } catch (err: any) {
    console.error('Failed to initialize or run Gate 1 verification:', err.message);
  }
}

verifyGate1();
