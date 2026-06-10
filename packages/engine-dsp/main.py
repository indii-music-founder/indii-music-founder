from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import librosa
import numpy as np
import io
import soundfile as sf
from google.cloud import storage

app = FastAPI(title="indii.music DSP Engine", description="Audio profiling and generative compositor node.")

class IngestionRequest(BaseModel):
    filePath: str
    masterAssetId: str

def validate_wav_magic_bytes(file_bytes: bytes):
    if len(file_bytes) < 12:
        raise ValueError("File too short.")
    magic_bytes = file_bytes[0:4]
    if magic_bytes != b'RIFF':
        raise ValueError("Invalid audio format: Not a RIFF container.")
    wave_header = file_bytes[8:12]
    if wave_header != b'WAVE':
        raise ValueError("Invalid audio format: Not a WAVE file.")

@app.post("/profile")
async def profile_audio(req: IngestionRequest):
    # Stream from Google Cloud Storage to avoid OOM
    try:
        storage_client = storage.Client()
        if req.filePath.startswith("gs://"):
            parts = req.filePath[5:].split("/", 1)
            bucket_name = parts[0]
            blob_name = parts[1]
        else:
            bucket_name = "indii-music-assets"
            blob_name = req.filePath
            
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        
        # Download first 12 bytes to check magic bytes without loading 100MB+ into RAM
        magic_bytes_chunk = blob.download_as_bytes(start=0, end=11)
        validate_wav_magic_bytes(magic_bytes_chunk)
        
        # Download the rest (in production, we'd stream directly to sf.blocks)
        file_bytes = blob.download_as_bytes()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to access or validate storage file: {str(e)}")
    
    # Process using librosa
    try:
        y, sr = sf.read(io.BytesIO(file_bytes))
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)

        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        transient_energy = float(np.sum(onset_env))
        
        return {
            "tempo_bpm": float(tempo[0] if isinstance(tempo, (list, np.ndarray)) else tempo),
            "transient_energy": transient_energy,
            "status": "success",
            "masterAssetId": req.masterAssetId
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DSP Processing failed: {str(e)}")

@app.post("/render")
async def render_generative_video(req: IngestionRequest):
    return {"status": "queued_for_render", "dlq_retry_count": 0, "masterAssetId": req.masterAssetId}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
