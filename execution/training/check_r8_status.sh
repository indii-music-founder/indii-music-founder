#!/bin/bash
# Check R8 (Gemini 3.1 Flash-Lite) fine-tuning job status
# Usage: bash execution/training/check_r8_status.sh

echo "📊 R8 Boardroom Swarm (3.1 Flash-Lite) Tuning Status ($(date))"
echo "----------------------------------------------------------------"

# Get project ID from gcloud config if not specified
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID="223837784072"
fi

curl -s \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/tuningJobs?pageSize=50" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
jobs = d.get('tuningJobs', [])
# Look for R8 or 3.1 labels in the model name
r8 = [j for j in jobs if 'r8' in j.get('tunedModelDisplayName','').lower() or '3.1' in j.get('tunedModelDisplayName','')]

if not r8:
    print('No R8 tuning jobs found.')
    sys.exit(0)

running = sum(1 for j in r8 if j.get('state') == 'JOB_STATE_RUNNING')
done = sum(1 for j in r8 if j.get('state') == 'JOB_STATE_SUCCEEDED')
failed = sum(1 for j in r8 if j.get('state') == 'JOB_STATE_FAILED')
pending = sum(1 for j in r8 if j.get('state') == 'JOB_STATE_PENDING')

print(f'Total R8 Jobs: {len(r8)} | ✅ Done: {done} | 🔄 Running: {running} | ⏳ Pending: {pending} | ❌ Failed: {failed}')
print()

# Print detailed list
for j in sorted(r8, key=lambda x: x.get('tunedModelDisplayName','')):
    name = j.get('tunedModelDisplayName','?')
    state = j.get('state','?')
    icon = {'JOB_STATE_SUCCEEDED':'✅','JOB_STATE_RUNNING':'🔄','JOB_STATE_PENDING':'⏳','JOB_STATE_FAILED':'❌'}.get(state,'❓')
    
    # Show endpoint/model ID for completed jobs
    endpoint = ''
    if state == 'JOB_STATE_SUCCEEDED':
        tuned = j.get('tunedModel', {})
        endpoint = tuned.get('endpoint', tuned.get('model', ''))
        if endpoint:
            # Extract just the last part of the resource name
            endpoint = f'  → {endpoint.split(\"/\")[-1]}'
    
    # Extract creation time
    created = j.get('createTime', '????-??-??').split('T')[0]
    
    print(f'{icon} {name:<30} {state:<18} [{created}] {endpoint}')

if done > 0 and done == len(r8):
    print()
    print('🎉 ALL R8 JOBS COMPLETE! Update packages/renderer/src/core/config/fine-tuned-models.ts')
"
