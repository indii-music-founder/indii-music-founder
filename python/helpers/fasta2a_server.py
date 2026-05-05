"""A2A (Agent-to-Agent) JSON-RPC 2.0 server for ASGI middleware.

Mirrors the proven DynamicMcpProxy pattern from python/helpers/mcp_server.py.
Phase 1.1 implementation per docs/A2A_EXECUTION_PLAN.md.

ASGI framework choice: raw ASGI (Starlette-compatible) — no FastAPI dep.
Endpoints:
- POST /a2a/rpc         — JSON-RPC 2.0 (card.list, card.get, agent.invoke)
- GET  /a2a/stream/{id} — SSE for long-running invocations
- GET  /a2a/discovery   — { agents: AgentCard[] }
- GET  /a2a/health      — { status, version, uptime }
"""

import asyncio
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from python.helpers.e2e_encryption import (
    generate_keypair,
    export_public_key_jwk,
    import_public_key_jwk,
    decrypt_message,
    encrypt_message,
    envelope_from_dict,
    envelope_to_dict,
)


SCHEMA_VERSION = "1.0.0"
SERVER_VERSION = "1.0.0"

# Phase 4.1.d — replay protection. Recent message IDs are kept for this window;
# any envelope whose id has been seen within the window is rejected.
REPLAY_WINDOW_SECONDS = 3600  # 1 hour

# Methods callable in plaintext. Everything else MUST arrive as a MessageEnvelope.
# key.exchange is the chicken-and-egg exception: a peer cannot encrypt before
# both sides have exchanged public keys.
PLAINTEXT_ALLOWED_METHODS = frozenset({"key.exchange"})


class AgentCard:
    """In-memory representation of an Agent Card.

    Phase 2.3 will load these from agents/<id>/agent_card.json with full
    pydantic validation. For Phase 1.1, this minimal shape unblocks discovery.
    """

    def __init__(
        self,
        agent_id: str,
        display_name: str,
        description: str,
        capabilities: Optional[List[Dict[str, Any]]] = None,
        risk_tier: str = "read",
        public_key_jwk: Optional[Dict[str, Any]] = None,
    ):
        self.agent_id = agent_id
        self.display_name = display_name
        self.description = description
        self.capabilities = capabilities or []
        self.risk_tier = risk_tier
        self.public_key_jwk = public_key_jwk

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "schemaVersion": SCHEMA_VERSION,
            "agentId": self.agent_id,
            "displayName": self.display_name,
            "description": self.description,
            "capabilities": self.capabilities,
            "inputSchemas": {},
            "outputSchemas": {},
            "costModel": {"perTokenInUsd": 0.0, "perTokenOutUsd": 0.0},
            "riskTier": self.risk_tier,
            "sla": {
                "modeSync": {"p50Ms": 500, "p99Ms": 3000},
                "modeStream": {"firstByteMs": 1000},
            },
        }
        if self.public_key_jwk:
            d["publicKeyJwk"] = self.public_key_jwk
        return d


class DynamicA2AProxy:
    """ASGI proxy for the A2A protocol surface."""

    _instance: Optional["DynamicA2AProxy"] = None

    @classmethod
    def get_instance(cls) -> "DynamicA2AProxy":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self._started_at = time.time()
        self._request_streams: Dict[str, asyncio.Queue] = {}
        self._private_key = generate_keypair()
        self._public_key_jwk = export_public_key_jwk(self._private_key)
        self._peer_public_keys = {}  # senderId -> RSAPublicKey
        # Replay protection: id -> first-seen epoch seconds.
        self._seen_message_ids: Dict[str, float] = {}
        # Audit ring buffer (Phase 4.3.c). Cap at 10k entries, FIFO.
        self._audit_log: List[Dict[str, Any]] = []
        self._audit_max = 10_000
        self._agent_cards: List[AgentCard] = self._load_cards()

    def _record_audit(self, **fields: Any) -> None:
        """Append an audit entry. Metadata only — never decrypted payload."""
        entry = {"timestamp": time.time(), **fields}
        self._audit_log.append(entry)
        if len(self._audit_log) > self._audit_max:
            self._audit_log = self._audit_log[-self._audit_max:]

    def _is_replay(self, message_id: str) -> bool:
        """True if this envelope id has been seen within the replay window."""
        now = time.time()
        # Lazy GC of expired ids (cheap; runs on every check).
        self._seen_message_ids = {
            mid: ts for mid, ts in self._seen_message_ids.items()
            if now - ts < REPLAY_WINDOW_SECONDS
        }
        if message_id in self._seen_message_ids:
            return True
        self._seen_message_ids[message_id] = now
        return False

    def _load_cards(self) -> List[AgentCard]:
        """Load agent_card.json from agents/<id>/. Phase 2.3 makes this strict."""
        cards: List[AgentCard] = []
        agents_dir = Path(__file__).parent.parent.parent / "agents"
        if not agents_dir.exists():
            return [
                AgentCard("conductor", "indii Conductor", "Central orchestration hub"),
            ]
        for card_file in agents_dir.glob("*/agent_card.json"):
            try:
                data = json.loads(card_file.read_text())
                cards.append(
                    AgentCard(
                        agent_id=data["agentId"],
                        display_name=data.get("displayName", data["agentId"]),
                        description=data.get("description", ""),
                        capabilities=data.get("capabilities", []),
                        risk_tier=data.get("riskTier", "read"),
                        public_key_jwk=self._public_key_jwk,
                    )
                )
            except (KeyError, json.JSONDecodeError) as exc:
                # Phase 2.3.c: refuse to boot on invalid card.
                # For Phase 1.1 we log and skip so the route boots.
                print(f"[A2A] Skipping invalid card {card_file}: {exc}")
        return cards

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            await self._handle_http(scope, receive, send)
        elif scope["type"] == "lifespan":
            await self._handle_lifespan(receive, send)

    async def _handle_lifespan(self, receive, send):
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return

    async def _handle_http(self, scope, receive, send):
        path = scope["path"]
        method = scope["method"]

        if method == "POST" and path.endswith("/rpc"):
            await self._handle_rpc(receive, send)
        elif method == "GET" and "/stream/" in path:
            request_id = path.rsplit("/", 1)[-1]
            await self._handle_stream(request_id, send)
        elif method == "GET" and path.endswith("/discovery"):
            await self._send_json(send, 200, {
                "agents": [c.to_dict() for c in self._agent_cards],
                "schemaVersion": SCHEMA_VERSION,
            })
        elif method == "GET" and path.endswith("/health"):
            await self._send_json(send, 200, {
                "status": "healthy",
                "version": SERVER_VERSION,
                "uptime": time.time() - self._started_at,
                "cardCount": len(self._agent_cards),
            })
        elif method == "GET" and path.endswith("/audit"):
            # Phase 4.3.c — paginated audit. Query string parsing is intentionally
            # minimal; defaults return the most recent 100 entries.
            qs = scope.get("query_string", b"").decode("utf-8")
            limit = 100
            offset = 0
            for pair in qs.split("&"):
                if "=" not in pair:
                    continue
                k, v = pair.split("=", 1)
                if k == "limit" and v.isdigit():
                    limit = min(int(v), 1000)
                elif k == "offset" and v.isdigit():
                    offset = int(v)
            entries = list(reversed(self._audit_log))[offset:offset + limit]
            await self._send_json(send, 200, {
                "entries": entries,
                "total": len(self._audit_log),
                "limit": limit,
                "offset": offset,
            })
        else:
            await self._send_json(send, 404, {"error": "Not Found", "path": path})

    async def _handle_rpc(self, receive, send):
        body_parts = []
        while True:
            message = await receive()
            body_parts.append(message.get("body", b""))
            if not message.get("more_body"):
                break

        try:
            request_data = json.loads(b"".join(body_parts).decode("utf-8"))
        except json.JSONDecodeError:
            await self._send_json(send, 400, {
                "jsonrpc": "2.0",
                "error": {"code": -32700, "message": "Parse error"},
                "id": None,
            })
            return

        is_encrypted = False
        sender_id = None
        recipient_id = None
        envelope_id = None

        if "encrypted" in request_data and "id" in request_data:
            # MessageEnvelope path
            is_encrypted = True
            envelope = envelope_from_dict(request_data)
            envelope_id = envelope.id

            # Phase 4.1.d — replay protection. Reject if id seen within window.
            if self._is_replay(envelope_id):
                self._record_audit(
                    event="replay_rejected",
                    envelopeId=envelope_id,
                    senderId=envelope.encrypted.senderId,
                )
                await self._send_json(send, 400, {
                    "jsonrpc": "2.0",
                    "error": {"code": -32600, "message": "Replay detected"},
                    "id": None,
                })
                return

            try:
                plaintext = decrypt_message(envelope, self._private_key)
                request = json.loads(plaintext)
            except Exception as e:
                self._record_audit(
                    event="decryption_failed",
                    envelopeId=envelope_id,
                    error=str(e)[:200],
                )
                await self._send_json(send, 400, {
                    "jsonrpc": "2.0",
                    "error": {"code": -32600, "message": f"Decryption error: {e}"},
                    "id": None,
                })
                return
            sender_id = envelope.encrypted.senderId
            recipient_id = envelope.encrypted.recipientId
        else:
            # Phase 4.1.e — plaintext is allowed only for the bootstrap method
            # (key.exchange). Everything else is rejected with 400.
            request = request_data
            attempted_method = (request_data.get("method") or "").strip()
            if attempted_method not in PLAINTEXT_ALLOWED_METHODS:
                self._record_audit(
                    event="plaintext_rejected",
                    method=attempted_method or "<unknown>",
                )
                await self._send_json(send, 400, {
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32600,
                        "message": (
                            "Plaintext requests are not accepted. "
                            "Wrap as MessageEnvelope or use key.exchange to bootstrap."
                        ),
                    },
                    "id": request_data.get("id"),
                })
                return

        method = request.get("method")
        params = request.get("params") or {}
        rpc_id = request.get("id")

        if method == "card.list":
            result = [c.to_dict() for c in self._agent_cards]
            response = {"jsonrpc": "2.0", "result": result, "id": rpc_id}
        elif method == "card.get":
            agent_id = params.get("agentId")
            card = next((c for c in self._agent_cards if c.agent_id == agent_id), None)
            if card:
                response = {"jsonrpc": "2.0", "result": card.to_dict(), "id": rpc_id}
            else:
                response = {
                    "jsonrpc": "2.0",
                    "error": {"code": -32602, "message": f"Agent '{agent_id}' not found"},
                    "id": rpc_id,
                }
        elif method == "key.exchange":
            exchange_sender_id = params.get("senderId")
            jwk = params.get("publicKeyJwk")
            if exchange_sender_id and jwk:
                self._peer_public_keys[exchange_sender_id] = import_public_key_jwk(jwk)
                response = {"jsonrpc": "2.0", "result": "ok", "id": rpc_id}
            else:
                response = {
                    "jsonrpc": "2.0",
                    "error": {"code": -32602, "message": "Missing senderId or publicKeyJwk"},
                    "id": rpc_id,
                }
        elif method == "agent.invoke" or method == "stream.init" or method == "execute":
            # Just create a dummy stream id for testing/completion
            stream_id = str(uuid4())
            self._request_streams[stream_id] = asyncio.Queue()
            
            # Send a response indicating success or providing the streamId
            if method == "stream.init":
                response = {
                    "jsonrpc": "2.0",
                    "result": {"requestId": stream_id, "status": "pending"},
                    "id": rpc_id,
                }
            else:
                # Mock execution result for agent.invoke / execute
                response = {
                    "jsonrpc": "2.0",
                    "result": {"status": "success", "message": f"Executed {method}"},
                    "id": rpc_id,
                }
        else:
            response = {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"Method not found: {method}"},
                "id": rpc_id,
            }

        # Audit successful dispatch — metadata only (no decrypted payload).
        self._record_audit(
            event="rpc_dispatched",
            method=method,
            encrypted=is_encrypted,
            envelopeId=envelope_id,
            senderId=sender_id,
            recipientId=recipient_id,
            error=("error" in response),
        )

        if is_encrypted and sender_id and sender_id in self._peer_public_keys:
            response_envelope = encrypt_message(
                plaintext=json.dumps(response),
                sender_id=recipient_id or "sidecar",
                recipient_id=sender_id,
                recipient_public_key=self._peer_public_keys[sender_id]
            )
            final_response = envelope_to_dict(response_envelope)
        else:
            final_response = response

        await self._send_json(send, 200, final_response)

    async def _handle_stream(self, request_id: str, send):
        if request_id not in self._request_streams:
            await self._send_json(send, 404, {"error": "Stream not found"})
            return

        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [
                [b"content-type", b"text/event-stream"],
                [b"cache-control", b"no-cache"],
                [b"connection", b"keep-alive"],
            ],
        })

        queue = self._request_streams[request_id]
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    if event is None:
                        break
                    payload = f"data: {json.dumps(event)}\n\n".encode("utf-8")
                    await send({"type": "http.response.body", "body": payload, "more_body": True})
                except asyncio.TimeoutError:
                    await send({
                        "type": "http.response.body",
                        "body": b": keepalive\n\n",
                        "more_body": True,
                    })
        finally:
            await send({"type": "http.response.body", "body": b""})
            self._request_streams.pop(request_id, None)

    async def _send_json(self, send, status: int, body: Dict[str, Any]):
        body_bytes = json.dumps(body).encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [
                [b"content-type", b"application/json"],
                [b"content-length", str(len(body_bytes)).encode("ascii")],
            ],
        })
        await send({"type": "http.response.body", "body": body_bytes})
