from python.helpers.api import ApiHandler
import os
import time
import uuid

class AuthBroker(ApiHandler):
    """
    Secrets Broker Sidecar - Manages Opaque Handles for Zero-Trust Security.

    Implements the Ephemeral Secrets Broker pattern from the Hybrid Agentic Architecture:
    - Opaque handles are returned instead of raw secrets
    - Handles expire after TTL (default 5 minutes)
    - Zeroization clears all handles immediately
    - Secrets are resolved from environment variables at execution time
    """

    # In-memory handle registry (use Redis in production for multi-instance)
    _handle_registry: dict = {}
    HANDLE_TTL_SECONDS = 300  # 5 minutes

    # Known secret IDs mapped to environment variables
    SECRET_MAP = {
        "google_api": "GOOGLE_API_KEY",
        "gemini_api": "GEMINI_API_KEY",
        "embedding_model": "EMBEDDING_MODEL",
    }

    methods = ["POST"]

    @staticmethod
    def get_methods():
        return ["POST"]

    @staticmethod
    def requires_csrf():
        return False

    @staticmethod
    def requires_api_key():
        return False

    def _resolve_secret(self, secret_id: str) -> str | None:
        """Resolve secret_id to actual secret value from environment."""
        env_var = self.SECRET_MAP.get(secret_id)
        if not env_var:
            return None
        return os.environ.get(env_var)

    def _cleanup_expired(self):
        """Remove expired handles from registry."""
        now = time.time()
        expired = [h for h, entry in self._handle_registry.items()
                   if now > entry.get("expires_at", 0)]
        for handle in expired:
            del self._handle_registry[handle]

    async def process(self, input_data, request):
        action = input_data.get("action")

        # Cleanup expired handles on each request
        self._cleanup_expired()

        if action == "generate_handle":
            secret_id = input_data.get("secret_id")
            if not secret_id:
                return {"error": "No secret_id provided"}

            # Resolve the actual secret
            actual_secret = self._resolve_secret(secret_id)
            if not actual_secret:
                return {"error": f"Unknown secret_id: {secret_id}"}

            # Generate opaque handle
            handle = f"opaque_handle_{uuid.uuid4().hex[:12]}"

            # Store mapping with TTL
            self._handle_registry[handle] = {
                "secret": actual_secret,
                "secret_id": secret_id,
                "created_at": time.time(),
                "expires_at": time.time() + self.HANDLE_TTL_SECONDS
            }

            return {
                "status": "success",
                "handle": handle,
                "expires_in": self.HANDLE_TTL_SECONDS
            }

        elif action == "resolve_handle":
            # Called by execution layer to get actual secret at runtime
            handle = input_data.get("handle")
            if not handle:
                return {"error": "No handle provided"}

            entry = self._handle_registry.get(handle)
            if not entry:
                return {"error": "Invalid or unknown handle"}

            if time.time() > entry.get("expires_at", 0):
                del self._handle_registry[handle]
                return {"error": "Handle expired"}

            return {
                "status": "success",
                "secret": entry["secret"]
            }

        elif action == "zeroize_session":
            # Revoke all handles immediately (post-task cleanup)
            count = len(self._handle_registry)
            self._handle_registry.clear()

            instruction = input_data.get("instruction", "unknown")
            print(f"[AuthBroker] Zeroized {count} handles after instruction: {instruction[:50]}...")

            return {
                "status": "success",
                "message": f"Zeroized {count} opaque handles.",
                "handles_cleared": count
            }

        elif action == "verify_intent":
            # R2A2 Gatekeeper confirmation loop
            # In production, this would check against policy or require user approval
            intent = input_data.get("intent")
            proposed_action = input_data.get("proposed_action")

            # Log for audit trail
            print(f"[AuthBroker] Intent verification: {intent} -> {proposed_action}")

            return {
                "status": "success",
                "gatekeeper_token": f"ok_{uuid.uuid4().hex[:8]}",
                "verified_at": time.time()
            }

        elif action == "list_handles":
            # Debug/admin action - list active handles (without exposing secrets)
            handles = [
                {
                    "handle": h,
                    "secret_id": entry.get("secret_id"),
                    "expires_in": int(entry.get("expires_at", 0) - time.time())
                }
                for h, entry in self._handle_registry.items()
            ]
            return {
                "status": "success",
                "active_handles": len(handles),
                "handles": handles
            }

        return {"error": f"Unknown action: {action}"}
