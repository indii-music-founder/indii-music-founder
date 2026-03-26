import os
import subprocess
import urllib.request
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")

agents = [
    "generalist", "finance", "legal", "distribution", "marketing", "brand", 
    "video", "music", "social", "publicist", "licensing", "publishing", 
    "road", "merchandise", "director", "producer", "security", "devops", 
    "screenwriter", "curriculum"
]

base_models = {
    "generalist": "gemini-2.5-pro",
    "finance": "gemini-2.5-flash",
    "legal": "gemini-2.5-flash",
    "distribution": "gemini-2.5-flash",
}

def get_token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()

def submit_job():
    token = get_token()
    
    for agent in agents:
        model_short = base_models.get(agent, "gemini-2.5-flash-lite")
        base_model = f"projects/223837784072/locations/us-central1/publishers/google/models/{model_short}"
        display_name = f"{agent}-r6"
        
        payload = {
            "baseModel": base_model,
            "supervisedTuningSpec": {
                "trainingDatasetUri": f"gs://indiios-training-data/{agent}/{agent}_train.jsonl",
                "validationDatasetUri": f"gs://indiios-training-data/{agent}/{agent}_eval.jsonl",
                "hyperParameters": {
                    "epochCount": "3"
                }
            },
            "tunedModelDisplayName": display_name
        }
        
        url = "https://us-central1-aiplatform.googleapis.com/v1/projects/223837784072/locations/us-central1/tuningJobs"
        
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode('utf-8'),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                job_id = response_data.get('name', 'Unknown')
                logging.info(f"✅ Submitted {agent} -> {job_id}")
        except urllib.error.HTTPError as e:
            err_data = e.read().decode('utf-8')
            logging.error(f"❌ Failed to submit {agent}: {e.code} - {err_data}")
        except Exception as e:
            logging.error(f"❌ Failed to submit {agent}: {e}")

if __name__ == "__main__":
    logging.info("Submitting 20 R6 tuning jobs...")
    submit_job()
