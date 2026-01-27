from python.helpers.tool import Tool, Response
import aiohttp
import json

class IndiiAuthTool(Tool):
    """
    Indii Auth Tool - Requests Opaque Handles from the Secrets Broker Sidecar.
    """
    async def execute(self, **kwargs) -> Response:
        secret_id = kwargs.get("secret_id")
        if not secret_id:
            return Response(message="Error: Missing secret_id.", break_loop=False)

        # The internal broker is mapped to /auth_broker via the dispatch middleware
        broker_url = "http://localhost/auth_broker"
        
        try:
            async with aiohttp.ClientSession() as session:
                payload = {"action": "generate_handle", "secret_id": secret_id}
                async with session.post(broker_url, json=payload) as resp:
                    if resp.status != 200:
                        return Response(message=f"Broker Error: {resp.status}", break_loop=False)
                    result = await resp.json()
                    
            if result.get("status") == "success":
                handle = result.get("handle")
                return Response(
                    message=f"Opaque handle generated: {handle}. Use this handle instead of the raw secret.",
                    break_loop=False,
                    additional={"opaque_handle": handle}
                )
            else:
                return Response(message=f"Auth Error: {result.get('error', 'Unknown error')}", break_loop=False)
        except Exception as e:
            return Response(message=f"Connection Error: {str(e)}", break_loop=False)
