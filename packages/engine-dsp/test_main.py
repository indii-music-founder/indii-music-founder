from __future__ import annotations

import unittest

from main import app, healthcheck


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


if __name__ == "__main__":
    unittest.main()
