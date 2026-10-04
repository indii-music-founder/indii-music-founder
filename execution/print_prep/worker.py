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
    userId: str
    sourceUri: str
    presetId: str
    bleedMode: str = Field(default="extend")
    focusX: float = Field(default=0.5)
    focusY: float = Field(default=0.5)
    generateGuide: bool = Field(default=False)


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

    # Mark job as processing
    job_ref.update({
        "status": "processing",
        "progress": 20,
    })

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            # 1. Download source image from GCS
            src_bucket_name, src_blob_name = parse_gcs_uri(payload.sourceUri)
            src_blob = storage_client.bucket(src_bucket_name).blob(src_blob_name)
            local_input = os.path.join(tmpdir, "source_input.png")
            src_blob.download_to_filename(local_input)

            # 2. Prepare paths
            local_output = os.path.join(tmpdir, "print_output.png")
            local_guide = os.path.join(tmpdir, "print_guide.png") if payload.generateGuide else None
            model_path = DEFAULT_MODEL_PATH if os.path.exists(DEFAULT_MODEL_PATH) else None

            # 3. Execute print prep
            job_ref.update({"progress": 40})
            prep_result = prepare_artwork(
                input_path=local_input,
                output_path=local_output,
                preset_id=payload.presetId,
                bleed_mode=payload.bleedMode,
                fx=payload.focusX,
                fy=payload.focusY,
                guide_path=local_guide,
                model_path=model_path,
            )

            job_ref.update({"progress": 80})

            # 4. Upload output to GCS
            output_blob_name = f"users/{payload.userId}/assets/print_ready_{payload.jobId}.png"
            output_blob = storage_client.bucket(src_bucket_name).blob(output_blob_name)
            output_blob.upload_from_filename(local_output, content_type="image/png")
            output_uri = f"gs://{src_bucket_name}/{output_blob_name}"

            guide_uri = None
            if local_guide and os.path.exists(local_guide):
                guide_blob_name = f"users/{payload.userId}/assets/print_guide_{payload.jobId}.png"
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
