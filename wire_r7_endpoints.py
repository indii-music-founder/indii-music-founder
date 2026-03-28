"""
wire_r7_endpoints.py

Queries all R7 Vertex AI tuning jobs, extracts their deployed endpoint IDs,
and updates src/services/agent/fine-tuned-models.ts in-place.

Usage:
    python3 wire_r7_endpoints.py           # dry-run: print new registry entries
    python3 wire_r7_endpoints.py --write   # apply changes to fine-tuned-models.ts
"""

import subprocess
import urllib.request
import urllib.error
import json
import sys
import re
import ssl

# macOS SSL workaround — token is already validated by gcloud auth
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

PROJECT = "223837784072"
REGION = "us-central1"
REGISTRY_FILE = "src/services/agent/fine-tuned-models.ts"

# R7 job IDs submitted 2026-03-27
R7_JOB_IDS = {
    "generalist":   "1057586819912171520",
    "finance":      "1529338880879230976",
    "legal":        "803133440965738496",
    "distribution": "1940292346876788736",
    "marketing":    "2369260211383828480",
    "brand":        "7132942717234970624",
    "video":        "6243481790829297664",
    "music":        "5492506552965267456",
    "social":       "4273156953854705664",
    "publicist":    "5303355368615706624",
    "licensing":    "3186663543751573504",
    "publishing":   "8884842972282093568",
    "road":         "5639436490808229888",
    "merchandise":  "2740807180641894400",
    "director":     "3108976450179432448",
    "producer":     "4920549400289214464",
    "security":     "6990516379019378688",
    "devops":       "2614706391075520512",
    "screenwriter": "4246135356090482688",
    "curriculum":   "8549324800042991616",
}

BASE_MODELS = {
    "generalist":   "gemini-2.5-pro",
    "finance":      "gemini-2.5-flash",
    "legal":        "gemini-2.5-flash",
    "distribution": "gemini-2.5-flash",
}

TRAIN_COUNTS = {
    "generalist": 132, "finance": 163, "legal": 133, "distribution": 164,
    "marketing": 139, "brand": 119, "video": 134, "music": 111, "social": 131,
    "publicist": 103, "licensing": 140, "publishing": 136, "road": 124,
    "merchandise": 132, "director": 132, "producer": 97, "security": 88,
    "devops": 125, "screenwriter": 131, "curriculum": 120,
}


def get_token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def get_job(token, job_id):
    url = f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/tuningJobs/{job_id}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, context=_ssl_ctx) as resp:
        return json.loads(resp.read())


def extract_endpoint_id(job_data):
    """Extract endpoint ID from tunedModel.endpoints[0] or tunedModel.name."""
    tuned = job_data.get("tunedModel", {})
    endpoints = tuned.get("endpoints", [])
    if endpoints:
        # endpoints[0] is typically "projects/.../endpoints/{id}"
        ep = endpoints[0].get("endpoint", "")
        if ep:
            return ep.split("/")[-1]
    # Fallback: sometimes it's under tunedModel.model
    model = tuned.get("model", "")
    if "/endpoints/" in model:
        return model.split("/endpoints/")[-1].split("/")[0]
    return None


def main():
    write_mode = "--write" in sys.argv
    token = get_token()

    print("Checking R7 job statuses...\n")

    results = {}
    failed = []
    running = []

    for agent, job_id in sorted(R7_JOB_IDS.items()):
        try:
            job = get_job(token, job_id)
            state = job.get("state", "UNKNOWN")
            if state == "JOB_STATE_SUCCEEDED":
                ep_id = extract_endpoint_id(job)
                if ep_id:
                    results[agent] = ep_id
                    print(f"  ✅ {agent:<15} SUCCEEDED  endpoint={ep_id}")
                else:
                    print(f"  ⚠️  {agent:<15} SUCCEEDED  (endpoint not yet deployed)")
                    running.append(agent)
            elif state == "JOB_STATE_RUNNING":
                print(f"  🔄 {agent:<15} RUNNING")
                running.append(agent)
            elif state in ("JOB_STATE_FAILED", "JOB_STATE_CANCELLED"):
                print(f"  ❌ {agent:<15} {state}")
                failed.append(agent)
            else:
                print(f"  ⏳ {agent:<15} {state}")
                running.append(agent)
        except Exception as e:
            print(f"  ❌ {agent:<15} ERROR: {e}")
            failed.append(agent)

    print(f"\n{'='*60}")
    print(f"Results: {len(results)} succeeded, {len(running)} pending, {len(failed)} failed")

    if not results:
        print("\nNo endpoints ready yet. Re-run when jobs complete.")
        return

    # Generate new registry entries
    date = "2026-03-27"
    new_entries = {}
    for agent, ep_id in sorted(results.items()):
        base = BASE_MODELS.get(agent, "gemini-2.5-flash-lite")
        count = TRAIN_COUNTS.get(agent, "?")
        comment = f"// R7 — {base} base (~{count} examples, ≥60% expert) — {date}"
        endpoint = f"projects/{PROJECT}/locations/{REGION}/endpoints/{ep_id}"
        new_entries[agent] = (comment, endpoint)

    print("\n--- New registry entries ---")
    for agent, (comment, endpoint) in sorted(new_entries.items()):
        print(f"    {comment}")
        print(f"    '{agent}':{' ' * (14-len(agent))}'{endpoint}',")
        print()

    if not write_mode:
        print("Dry-run complete. Pass --write to update fine-tuned-models.ts")
        return

    # Apply to fine-tuned-models.ts
    with open(REGISTRY_FILE, "r") as f:
        content = f.read()

    for agent, (comment, endpoint) in new_entries.items():
        # Match existing R6 line for this agent and replace it
        pattern = rf"(    // R6[^\n]*\n    '{re.escape(agent)}':\s*)'[^']*',"
        replacement = f"    {comment}\n    '{agent}':{' ' * (14-len(agent))}'{endpoint}',"
        new_content, count = re.subn(pattern, replacement, content)
        if count > 0:
            content = new_content
            print(f"  ✏️  Updated {agent}")
        else:
            print(f"  ⚠️  No match found for {agent} — add manually")

    with open(REGISTRY_FILE, "w") as f:
        f.write(content)

    print(f"\n✅ {REGISTRY_FILE} updated with {len(new_entries)} R7 endpoints.")
    print("Next: commit the file and verify VITE_USE_FINE_TUNED_AGENTS=true in .env")


if __name__ == "__main__":
    main()
