from python.helpers.api import ApiHandler

class Healthz(ApiHandler):
    """
    Health check endpoint for Docker container monitoring.
    Returns service status for orchestration health checks.
    """
    methods = ["GET"]

    @staticmethod
    def get_methods():
        return ["GET"]

    @staticmethod
    def requires_csrf():
        return False

    @staticmethod
    def requires_api_key():
        return False

    async def process(self, input_data, request):
        return {
            "status": "healthy",
            "service": "indii-agent",
            "version": "0.1.0"
        }
