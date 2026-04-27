import { GoogleAuth } from 'google-auth-library';

async function checkVertexTuningJobs() {
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const projectId = 'indiios-v-1-1';
    const location = 'us-central1';
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to obtain Google Cloud access token.');
    }

    const url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/tuningJobs`;

    const res = await fetch(url, {
      method: 'GET',
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
