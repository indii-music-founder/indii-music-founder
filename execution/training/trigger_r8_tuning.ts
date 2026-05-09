import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Trigger Vertex AI Fine-Tuning Job for Round 8 (Gemini 3.1 Flash-Lite)
 * 
 * This script automates the creation of supervised fine-tuning jobs on Vertex AI.
 * It assumes the training/validation datasets are already uploaded to GCS.
 * 
 * Usage:
 *   export $(grep -v '^#' .env | xargs)
 *   npx ts-node execution/training/trigger_r8_tuning.ts --agent=generalist
 */

async function triggerTuningJob(agentId: string) {
    console.log(`\n🚀 Triggering R8 Tuning Job for: ${agentId}`);
    
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

    const tunedModelDisplayName = `r8-${agentId}-3.1-flash-lite-${new Date().toISOString().split('T')[0]}`;
    const datasetGcsUri = `gs://indiios-training-data/ft_export/r8/${agentId}_train.jsonl`;
    const evalDatasetGcsUri = `gs://indiios-training-data/ft_export/r8/${agentId}_eval.jsonl`;

    const url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/tuningJobs`;

    const body = {
        baseModel: "projects/google/locations/us-central1/publishers/google/models/gemini-3.1-flash-lite-preview",
        tunedModelDisplayName: tunedModelDisplayName,
        supervisedTuningSpec: {
            trainingDatasetUri: datasetGcsUri,
            validationDatasetUri: evalDatasetGcsUri,
            hyperParameters: {
                epochCount: 3,
                learningRateMultiplier: 1.0,
                adapterSize: 16
            }
        },
        description: `Round 8 Swarm-Native Training for ${agentId} agent`
    };

    console.log(`   Model: ${body.baseModel}`);
    console.log(`   Dataset: ${datasetGcsUri}`);
    console.log(`   Target: ${tunedModelDisplayName}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });

    if (res.ok) {
        const data = await res.json();
        console.log(`✅ Success! Job created: ${data.name}`);
        console.log(`   State: ${data.state}`);
    } else {
        const errorText = await res.text();
        console.error(`❌ Failed: ${res.status} ${errorText}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const getArg = (key: string) => {
        const flag = args.find(a => a.startsWith(`--${key}=`));
        return flag ? flag.split('=')[1] : undefined;
    };

    const agentArg = getArg('agent');
    if (!agentArg) {
        console.error('Usage: npx ts-node execution/training/trigger_r8_tuning.ts --agent=<id|all>');
        process.exit(1);
    }

    const KNOWN_AGENTS = [
        'generalist', 'finance', 'legal', 'distribution', 'marketing',
        'brand', 'video', 'music', 'social', 'publicist',
        'licensing', 'publishing', 'road', 'merchandise', 'director',
        'producer', 'security', 'devops', 'screenwriter', 'curriculum'
    ];

    const agents = agentArg === 'all' ? KNOWN_AGENTS : agentArg.split(',');

    for (const id of agents) {
        try {
            await triggerTuningJob(id);
        } catch (err: any) {
            console.error(`Error for ${id}:`, err.message);
        }
    }
}

main();
