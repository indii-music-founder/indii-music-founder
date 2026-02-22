class PrintStyle:
    def __init__(self, *args, **kwargs):
        pass
    def print(self, message, *args, **kwargs):
        print(message)
    @staticmethod
    def error(message, *args, **kwargs):
        print(f"ERROR: {message}")
