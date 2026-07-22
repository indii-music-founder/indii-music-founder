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


if __name__ == "__main__":
    unittest.main()
