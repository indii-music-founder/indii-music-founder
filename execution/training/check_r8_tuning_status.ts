import { GoogleAuth } from 'google-auth-library';

async function checkTuningStatus() {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const projectId = '223837784072';
    const location = 'us-central1';
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
        throw new Error('Failed to obtain Google Cloud access token.');
    }

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/tuningJobs`;

    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
        }
    });

    if (res.ok) {
        const data = await res.json();
        const jobs = data.tuningJobs || [];
        
        // Filter jobs created today/for R8
        const r8Jobs = jobs.filter((j: any) => j.tunedModelDisplayName && j.tunedModelDisplayName.startsWith('r8-'));
        
        console.log(`\n📊 Status of R8 Tuning Jobs (Total: ${r8Jobs.length}):\n`);
        
        const states: Record<string, number> = {};
        
        r8Jobs.forEach((job: any) => {
            const agent = job.tunedModelDisplayName.split('-')[1];
            const state = job.state;
            
            states[state] = (states[state] || 0) + 1;
            
            if (state === 'JOB_STATE_FAILED') {
                console.log(`- ${agent}: ${state} -> ${job.error?.message}`);
            } else {
                console.log(`- ${agent}: ${state}`);
            }
        });

        console.log('\n📈 Summary:');
        for (const [state, count] of Object.entries(states)) {
            console.log(`  ${state}: ${count}`);
        }
        
    } else {
        const errorText = await res.text();
        console.error(`❌ Failed: ${res.status} ${errorText}`);
    }
}

checkTuningStatus();
