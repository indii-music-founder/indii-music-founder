"""MCP (Model Context Protocol) server proxy for ASGI middleware."""


class DynamicMcpProxy:
    """Proxy ASGI app for MCP server."""

    _instance = None

    @classmethod
    def get_instance(cls):
        """Get singleton instance of MCP proxy."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def __call__(self, scope, receive, send):
        """ASGI interface."""
        if scope["type"] == "http":
            # For now, return a simple 501 Not Implemented
            await send({
                "type": "http.response.start",
                "status": 501,
                "headers": [[b"content-type", b"text/plain"]],
            })
            await send({
                "type": "http.response.body",
                "body": b"MCP server not yet implemented",
            })
        elif scope["type"] == "lifespan":
            # Handle lifespan events
            while True:
                message = await receive()
                if message["type"] == "lifespan.startup":
                    await send({"type": "lifespan.startup.complete"})
                elif message["type"] == "lifespan.shutdown":
                    await send({"type": "lifespan.shutdown.complete"})
                    return
