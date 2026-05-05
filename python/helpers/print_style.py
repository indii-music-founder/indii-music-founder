class PrintStyle:
    """Terminal color/style printer for CLI output."""

    def debug(self, msg: str):
        print(f"[DEBUG] {msg}")

    def info(self, msg: str):
        print(f"[INFO] {msg}")

    def warn(self, msg: str):
        print(f"[WARN] {msg}")

    def error(self, msg: str):
        print(f"[ERROR] {msg}")

    def success(self, msg: str):
        print(f"[SUCCESS] {msg}")
