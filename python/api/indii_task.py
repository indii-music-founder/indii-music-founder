from python.helpers.api import ApiHandler

class IndiiTask(ApiHandler):
    """
    API Handler for executing Agent Zero tasks via IndiiOS.
    Simplified handler for basic connectivity testing.
    """
    methods = ['GET', 'POST']

    @staticmethod
    def get_methods():
        return ['GET', 'POST']

    @staticmethod
    def requires_csrf():
        return False

    @staticmethod
    def requires_api_key():
        return False

    async def process(self, input_data, request):
        instruction = input_data.get("instruction")
        
        if request.method == 'GET':
            return {'status': 'ok', 'message': 'IndiiTask endpoint is operational'}
        
        if not instruction:
            return {'status': 'error', 'message': 'No instruction provided'}

        # For now, return a simple acknowledgement
        # Full Agent Zero integration will be re-enabled after stability is confirmed
        return {
            'status': 'success',
            'instruction': instruction,
            'message': 'Instruction received. Agent Zero integration pending.'
        }
