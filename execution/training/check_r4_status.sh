#!/bin/bash
# Check R4 fine-tuning job status
# Usage: bash execution/training/check_r4_status.sh

echo "📊 R4 Fine-Tuning Job Status ($(date))"
echo ""

curl -s \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/223837784072/locations/us-central1/tuningJobs?pageSize=25" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
jobs = d.get('tuningJobs', [])
r4 = [j for j in jobs if 'r4' in j.get('tunedModelDisplayName','')]

running = sum(1 for j in r4 if j.get('state') == 'JOB_STATE_RUNNING')
done = sum(1 for j in r4 if j.get('state') == 'JOB_STATE_SUCCEEDED')
failed = sum(1 for j in r4 if j.get('state') == 'JOB_STATE_FAILED')
pending = sum(1 for j in r4 if j.get('state') == 'JOB_STATE_PENDING')

print(f'Total: {len(r4)} | ✅ Done: {done} | 🔄 Running: {running} | ⏳ Pending: {pending} | ❌ Failed: {failed}')
print()

for j in sorted(r4, key=lambda x: x.get('tunedModelDisplayName','')):
    name = j.get('tunedModelDisplayName','?')
    state = j.get('state','?')
    icon = {'JOB_STATE_SUCCEEDED':'✅','JOB_STATE_RUNNING':'🔄','JOB_STATE_PENDING':'⏳','JOB_STATE_FAILED':'❌'}.get(state,'❓')
    
    # Show endpoint for completed jobs
    endpoint = ''
    if state == 'JOB_STATE_SUCCEEDED':
        tuned = j.get('tunedModel', {})
        endpoint = tuned.get('endpoint', tuned.get('model', ''))
        if endpoint:
            endpoint = f'  → {endpoint.split(\"/\")[-1]}'
    
    print(f'{icon} {name:<28} {state}{endpoint}')

if done == len(r4):
    print()
    print('🎉 ALL JOBS COMPLETE! Run update_endpoints.sh to deploy.')
"
