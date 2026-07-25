from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException

from main import app, healthcheck, produce_session_proxy
from video_session_pipeline import (
    OriginalVerificationFailed,
    ProxyJobConflict,
    ProxyJobInProgress,
    VideoProxyRequest,
)


class HealthRouteTests(unittest.TestCase):
    def test_local_and_cloud_run_health_routes_share_the_same_handler(self):
        health_routes = {
            route.path: route.endpoint
            for route in app.routes
            if route.path in {"/health", "/healthz"}
        }

        self.assertEqual(set(health_routes), {"/health", "/healthz"})
        self.assertIs(health_routes["/health"], healthcheck)
        self.assertIs(health_routes["/healthz"], healthcheck)
        self.assertEqual(healthcheck(), {"status": "ok"})


class ProxyRouteTests(unittest.TestCase):
    @staticmethod
    def request() -> VideoProxyRequest:
        return VideoProxyRequest.model_validate({
            "sessionId": "a" * 40,
            "ownerUid": "artist-1",
            "organizationId": "org-1",
            "projectId": "project-1",
            "bucket": "private-media-bucket",
            "path": f"session-media/artist-1/{'a' * 40}/original/{'b' * 64}.mp4",
            "generation": "1001",
            "sha256": "b" * 64,
            "mimeType": "video/mp4",
            "byteSize": 1024,
            "jobId": "proxy-job-1",
        })

    def test_the_proxy_route_the_dispatcher_posts_to_is_registered(self):
        # `dispatchSessionProxyJob.ts` builds its URL as
        # `new URL('/proxy', config.workerUrl)` — this route path must match
        # that literal string exactly.
        proxy_routes = [route for route in app.routes if route.path == "/proxy"]
        self.assertEqual(len(proxy_routes), 1)
        self.assertIn("POST", proxy_routes[0].methods)

    def test_importing_main_does_not_require_configuration_or_construct_clients(self):
        # `get_video_pipeline()` is lazy (lru_cache), same as `get_pipeline()` —
        # module import must stay side-effect-free so /health responds even
        # when SESSION_MEDIA_BUCKET (or GCP credentials) are entirely absent,
        # exactly like the existing audio pipeline's import-safety guarantee.
        self.assertEqual(healthcheck(), {"status": "ok"})

    def test_cancelled_worker_result_is_acknowledged_without_requiring_a_manifest(self):
        pipeline = Mock()
        pipeline.run.return_value = {
            "status": "discarded",
            "reused": True,
            "terminalStatus": "cancelled",
        }

        with patch("main.get_video_pipeline", return_value=pipeline):
            result = produce_session_proxy(self.request())

        self.assertEqual(result, {
            "status": "discarded",
            "reused": True,
            "terminalStatus": "cancelled",
        })

    def test_permanent_claim_conflict_is_acknowledged_instead_of_retried(self):
        pipeline = Mock()
        pipeline.run.side_effect = ProxyJobConflict("cancelled")

        with patch("main.get_video_pipeline", return_value=pipeline):
            result = produce_session_proxy(self.request())

        self.assertEqual(result, {
            "status": "rejected",
            "reason": "proxy-job-conflict",
        })

    def test_original_verification_failure_is_acknowledged_after_terminal_record(self):
        pipeline = Mock()
        pipeline.run.side_effect = OriginalVerificationFailed("hash mismatch")

        with patch("main.get_video_pipeline", return_value=pipeline):
            result = produce_session_proxy(self.request())

        self.assertEqual(result, {
            "status": "failed",
            "reason": "original-verification-failed",
        })

    def test_live_lease_remains_retryable(self):
        pipeline = Mock()
        pipeline.run.side_effect = ProxyJobInProgress("lease active")

        with patch("main.get_video_pipeline", return_value=pipeline):
            with self.assertRaises(HTTPException) as raised:
                produce_session_proxy(self.request())
        self.assertEqual(raised.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
