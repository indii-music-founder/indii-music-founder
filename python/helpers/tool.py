class Response:
    def __init__(self, message, break_loop=False, additional=None):
        self.message = message
        self.break_loop = break_loop
        self.additional = additional or {}

class Tool:
    def __init__(self):
        self.agent = None

    def set_progress(self, message):
        print(f"[PROGRESS] {message}")

    async def execute(self, **kwargs):
        raise NotImplementedError("Subclasses must implement execute")
