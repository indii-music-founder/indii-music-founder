import time
from python.helpers.api import ApiHandler

# Track server start time for uptime calculation
_START_TIME = time.time()
SIDECAR_VERSION = "1.0.0"

class Healthz(ApiHandler):
    methods = ['GET']

    @staticmethod
    def get_methods():
        return ['GET']

    @staticmethod
    def requires_csrf():
        return False

    @staticmethod
    def requires_api_key():
        return False

    async def process(self, input_data, request):
        # Item 391: Return structured health response for Electron status indicator
        uptime_seconds = int(time.time() - _START_TIME)
        return {
            'status': 'ok',
            'version': SIDECAR_VERSION,
            'uptime': uptime_seconds,
        }
