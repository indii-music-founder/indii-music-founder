from __future__ import annotations

import logging
import os
import tempfile
from functools import lru_cache
from pathlib import Path

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
from video_session_pipeline import (
    OriginalVerificationFailed,
    ProxyJobConflict,
    ProxyJobInProgress,
    ProxyPipelineConfigurationError,
    SessionNotFound,
    VideoProxyRequest,
    VideoSessionProxyPipeline,
    build_pipeline_from_environment as build_video_pipeline_from_environment,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="indii.music DSP Engine",
    description="Immutable canonical-master profiling and provenance worker.",
)


@lru_cache(maxsize=1)
def get_pipeline() -> AudioAnalysisPipeline:
    return build_pipeline_from_environment()


@lru_cache(maxsize=1)
def get_video_pipeline() -> VideoSessionProxyPipeline:
    return build_video_pipeline_from_environment(dict(os.environ))


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


@app.post("/proxy")
def produce_session_proxy(request: VideoProxyRequest) -> dict:
    """Repair-order step 3 (ISSUE-1175): the worker `dispatchSessionProxyJob.ts`
    dispatches to. Runs under Cloud Tasks with an OIDC-authenticated POST — auth
    itself is Cloud Run's job (the invoker service account), not this handler's.
    """
    try:
        with tempfile.TemporaryDirectory() as directory:
            result = get_video_pipeline().run(request, Path(directory))
    except SessionNotFound:
        # The task is bound to a session created before enqueue. If it no longer
        # exists, repeating this exact task cannot recreate it.
        logger.warning("Discarding proxy task for a missing video session")
        return {"status": "rejected", "reason": "session-not-found"}
    except ProxyJobConflict:
        # Foreign/stale/cancelled state is permanent for this deterministic
        # task identity. Cloud Tasks retries every non-2xx response, including
        # 409, so acknowledge it instead of creating a retry storm.
        logger.warning("Discarding proxy task whose persisted claim no longer matches")
        return {"status": "rejected", "reason": "proxy-job-conflict"}
    except ProxyJobInProgress as error:
        # A live lease is transient. A later Cloud Tasks retry can recover
        # after the lease expires.
        raise HTTPException(status_code=409, detail=str(error)) from error
    except OriginalVerificationFailed:
        # The pipeline records this as an auditable terminal failed session
        # before raising. Retrying cannot change the immutable original bytes.
        return {"status": "failed", "reason": "original-verification-failed"}
    except ProxyPipelineConfigurationError as error:
        # Covers both "the worker itself is unconfigured" and "processing threw
        # an unclassified/transient error" — see the docstring on that
        # exception. Either way 503 is a retryable signal to Cloud Tasks, which
        # is correct for both cases.
        logger.exception("Session proxy worker configuration or processing error")
        raise HTTPException(status_code=503, detail="Session proxy worker is not configured or processing failed") from error
    except Exception as error:
        logger.exception("Session proxy production failed")
        raise HTTPException(status_code=500, detail="Session proxy production failed") from error

    if result["status"] == "failed":
        # Permanently failed (this attempt's own verification, or a cached
        # replay of an earlier one). 200, not an error status: the job is
        # DONE — acknowledging with 2xx is what stops Cloud Tasks from
        # retrying something that can never succeed.
        return {"status": "failed", "reused": result.get("reused", False), "failure": result["failure"]}

    if result["status"] == "discarded":
        # Cancellation or a newer lease won after this worker uploaded its
        # job-scoped derivatives. The pipeline already removed cancellation
        # output and intentionally returned no manifest. Acknowledge the
        # terminal/discarded attempt with 2xx so Cloud Tasks does not retry it.
        return {
            "status": "discarded",
            "reused": result.get("reused", False),
            "terminalStatus": result.get("terminalStatus"),
        }

    manifest = result["manifest"]
    return {
        "status": "completed",
        "reused": result.get("reused", False),
        "manifestId": manifest["manifestId"],
        "sessionId": manifest["sessionId"],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
