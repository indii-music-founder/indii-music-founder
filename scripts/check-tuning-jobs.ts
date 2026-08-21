import { GoogleAuth } from 'google-auth-library';

function getVertexAIBaseUrl(location: string): string {
  if (location === 'global' || location === 'us' || location === 'eu') {
    return 'https://aiplatform.googleapis.com';
  }
  return `https://${location}-aiplatform.googleapis.com`;
}

async function checkVertexTuningJobs() {
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const projectId = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'indii-music-founder';
    const location = process.env.VERTEX_TUNING_LOCATION || 'us-central1';
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to obtain Google Cloud access token.');
    }

    const url = `${getVertexAIBaseUrl(location)}/v1beta1/projects/${projectId}/locations/${location}/tuningJobs`;

    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(30000),
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
      }
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`Found ${data.tuningJobs?.length || 0} tuning jobs`);
      if (data.tuningJobs?.length) {
        const sorted = data.tuningJobs.sort((a: any, b: any) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
        console.log('Most recent 5 jobs:');
        sorted.slice(0, 5).forEach((j: any) => {
          console.log(`- ${j.name} | ${j.state} | ${j.createTime}`);
          console.log(`  display name/desc: ${j.description || j.tunedModelDisplayName || 'unknown'}`);
          console.log(`  tunedModel: ${j.tunedModel ? JSON.stringify(j.tunedModel) : 'none'}`);
        });
      }
    } else {
      console.error(`Error: ${res.status} ${await res.text()}`);
    }

  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

checkVertexTuningJobs();
