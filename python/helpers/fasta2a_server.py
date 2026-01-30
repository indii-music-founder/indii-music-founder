
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

async def homepage(request):
    return JSONResponse({'hello': 'world'})

class DynamicA2AProxy:
    _instance = None
    
    def __init__(self):
        # Create a simple Starlette app as a placeholder or proxy
        self.app = Starlette(debug=True, routes=[
            Route('/', homepage),
            # Add A2A specific routes here if known
        ])

    @staticmethod
    def get_instance():
        if DynamicA2AProxy._instance is None:
            DynamicA2AProxy._instance = DynamicA2AProxy()
        return DynamicA2AProxy._instance.app
