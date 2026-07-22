from __future__ import annotations

import logging
from functools import lru_cache

from fastapi import FastAPI, HTTPException

from pipeline import (
    AnalysisInProgress,
    AudioAnalysisPipeline,
    CanonicalMasterRejected,
    IngestionRequest,
    PipelineConfigurationError,
    StaleAnalysisLease,
    build_pipeline_from_environment,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="indii.music DSP Engine",
    description="Immutable canonical-master profiling and provenance worker.",
)


@lru_cache(maxsize=1)
def get_pipeline() -> AudioAnalysisPipeline:
    return build_pipeline_from_environment()


# /healthz is retained for local tooling, but Google's frontend intercepts the
# literal path "/healthz" on *.run.app URLs and answers 404 before the request
# reaches the container (verified live 2026-07-21). Remote checks must use /health.
@app.get("/healthz")
@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/profile")
def profile_audio(request: IngestionRequest) -> dict:
    try:
        receipt = get_pipeline().run(request)
        return {
            "status": receipt.get("status", "complete"),
            "receiptId": receipt.get("receiptId"),
            "contentHash": request.content_hash,
            "generation": request.generation,
            "masterFingerprint": request.master_fingerprint,
        }
    except AnalysisInProgress as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except CanonicalMasterRejected as error:
        raise HTTPException(status_code=412, detail=str(error)) from error
    except PipelineConfigurationError as error:
        logger.exception("DSP worker configuration is invalid")
        raise HTTPException(status_code=503, detail="Audio analysis worker is not configured") from error
    except StaleAnalysisLease as error:
        logger.exception("DSP worker lost its analysis lease")
        raise HTTPException(status_code=409, detail=str(error)) from error
    except Exception as error:
        logger.exception("Canonical-master analysis failed")
        raise HTTPException(status_code=500, detail="Canonical-master analysis failed") from error


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
