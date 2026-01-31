from python.helpers.api import ApiHandler

class TestRoute(ApiHandler):
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
        return {"status": "ok", "message": "Test Route Works"}
