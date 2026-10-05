"""worker.py

FastAPI Cloud Run GPU Worker for indii AI Image Upscaler + Print Prep.
Designed for NVIDIA L4 on Cloud Run with scale-to-zero ($0 idle cost).
- Downloads source image from Google Cloud Storage
- Runs deterministic print prep and Spandrel ESRGAN upscaling
- Uploads final 300 DPI print-ready image and guide overlay to GCS
- Updates Firestore job status to 'processing' -> 'done' or 'failed'
"""

import os
import sys
import tempfile
import traceback
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field

# Ensure execution package path is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from execution.print_prep.print_prep import prepare_artwork, plan_print

app = FastAPI(title="indii Print Prep Worker", version="1.0.0")

MODEL_DIR = os.environ.get("MODEL_DIR", "/app/models")
DEFAULT_MODEL_PATH = os.path.join(MODEL_DIR, "RealESRGAN_x4plus.pth")

try:
    import torch
    CUDA_AVAILABLE = torch.cuda.is_available()
    DEVICE_NAME = torch.cuda.get_device_name(0) if CUDA_AVAILABLE else "CPU"
except ImportError:
    CUDA_AVAILABLE = False
    DEVICE_NAME = "Torch not installed"

try:
    from google.cloud import firestore, storage
    GCP_CLIENTS_AVAILABLE = True
except ImportError:
    GCP_CLIENTS_AVAILABLE = False


class ProcessJobRequest(BaseModel):
    jobId: str


def parse_gcs_uri(uri: str):
    """Parses gs://bucket/path into (bucket_name, object_path)."""
    if not uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS URI: {uri}")
    parts = uri[5:].split("/", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid GCS URI: {uri}")
    return parts[0], parts[1]


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "cuda": CUDA_AVAILABLE,
        "device": DEVICE_NAME,
        "weightsPresent": os.path.exists(DEFAULT_MODEL_PATH),
    }


@app.post("/process")
async def process_job(payload: ProcessJobRequest):
    if not GCP_CLIENTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="Google Cloud libraries not installed in worker environment.")

    storage_client = storage.Client()
    db = firestore.Client()
    job_ref = db.collection("print_jobs").document(payload.jobId)
    job_snapshot = job_ref.get()
    if not job_snapshot.exists:
        raise HTTPException(status_code=404, detail="Print job not found.")
    job = job_snapshot.to_dict() or {}
    required = ("userId", "sourceUri", "presetId")
    if any(not isinstance(job.get(key), str) or not job[key].strip() for key in required):
        raise HTTPException(status_code=409, detail="Stored print job is invalid.")
    if job.get("status") not in ("dispatching", "queued"):
        # Cloud Tasks is at-least-once: acknowledge duplicate deliveries after
        # processing has started or completed, without re-running paid GPU work.
        if job.get("status") in ("processing", "done", "failed"):
            return {"success": True, "jobId": payload.jobId, "duplicate": True}
        raise HTTPException(status_code=409, detail="Print job is not dispatchable.")

    user_id = job["userId"]
    source_uri = job["sourceUri"]
    preset_id = job["presetId"]
    bleed_mode = job.get("bleedMode", "extend")
    focus_x = job.get("focusX", 0.5)
    focus_y = job.get("focusY", 0.5)
    generate_guide = bool(job.get("generateGuide", False))
    bucket_name, source_path = parse_gcs_uri(source_uri)
    if not source_path.startswith((f"users/{user_id}/", f"creative/{user_id}/")):
        raise HTTPException(status_code=403, detail="Print source is not owned by the job user.")

    # Mark job as processing
    transaction = db.transaction()
    @firestore.transactional
    def claim_job(tx):
        current_snapshot = job_ref.get(transaction=tx)
        current = current_snapshot.to_dict() or {}
        if current.get("status") not in ("dispatching", "queued"):
            return False
        tx.update(job_ref, {"status": "processing", "progress": 20})
        return True

    if not claim_job(transaction):
        return {"success": True, "jobId": payload.jobId, "duplicate": True}

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            # 1. Download source image from GCS
            src_bucket_name, src_blob_name = bucket_name, source_path
            src_blob = storage_client.bucket(src_bucket_name).blob(src_blob_name)
            local_input = os.path.join(tmpdir, "source_input.png")
            src_blob.download_to_filename(local_input)

            # 2. Prepare paths
            local_output = os.path.join(tmpdir, "print_output.png")
            local_guide = os.path.join(tmpdir, "print_guide.png") if generate_guide else None
            model_path = DEFAULT_MODEL_PATH if os.path.exists(DEFAULT_MODEL_PATH) else None

            # 3. Execute print prep
            job_ref.update({"progress": 40})
            prep_result = prepare_artwork(
                input_path=local_input,
                output_path=local_output,
                preset_id=preset_id,
                bleed_mode=bleed_mode,
                fx=focus_x,
                fy=focus_y,
                guide_path=local_guide,
                model_path=model_path,
            )

            job_ref.update({"progress": 80})

            # 4. Upload output to GCS
            output_blob_name = f"users/{user_id}/assets/print_ready_{payload.jobId}.png"
            output_blob = storage_client.bucket(src_bucket_name).blob(output_blob_name)
            output_blob.upload_from_filename(local_output, content_type="image/png")
            output_uri = f"gs://{src_bucket_name}/{output_blob_name}"

            guide_uri = None
            if local_guide and os.path.exists(local_guide):
                guide_blob_name = f"users/{user_id}/assets/print_guide_{payload.jobId}.png"
                guide_blob = storage_client.bucket(src_bucket_name).blob(guide_blob_name)
                guide_blob.upload_from_filename(local_guide, content_type="image/png")
                guide_uri = f"gs://{src_bucket_name}/{guide_blob_name}"

            # 5. Complete job in Firestore
            plan = prep_result["plan"]
            job_ref.update({
                "status": "done",
                "progress": 100,
                "outputUri": output_uri,
                "guideUri": guide_uri,
                "plan": {
                    "requiredWidthPx": plan["required"]["width"],
                    "requiredHeightPx": plan["required"]["height"],
                    "trimWidthIn": plan["trimIn"]["width"],
                    "trimHeightIn": plan["trimIn"]["height"],
                    "bleedIn": plan["bleedIn"],
                    "safeIn": plan["safeIn"],
                    "dpi": plan["dpi"],
                    "requiredUpscaleFactor": plan["requiredUpscaleFactor"],
                    "verdict": plan["verdict"],
                },
                "completedAt": firestore.SERVER_TIMESTAMP,
            })

            return {
                "success": True,
                "jobId": payload.jobId,
                "outputUri": output_uri,
                "guideUri": guide_uri,
            }

        except Exception as e:
            tb = traceback.format_exc()
            job_ref.update({
                "status": "failed",
                "error": str(e),
                "completedAt": firestore.SERVER_TIMESTAMP,
            })
            raise HTTPException(status_code=500, detail=f"Print prep processing failed: {str(e)}\n{tb}")
