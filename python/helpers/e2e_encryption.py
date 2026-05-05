"""E2E encryption helpers for A2A protocol — Python counterpart to E2EEncryptionService.ts.

Algorithm parameters MUST match the frontend WebCrypto implementation exactly:
- RSA-OAEP / SHA-256 / 4096-bit modulus for asymmetric key exchange
- AES-GCM / 12-byte IV / 128-bit auth tag for symmetric message encryption

Drift here is a session-killer (Risk #2 from the execution plan).
"""

import base64
import json
import os
import time
from dataclasses import dataclass, asdict
from typing import Optional
from uuid import uuid4

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


RSA_KEY_SIZE = 4096
RSA_PUBLIC_EXPONENT = 65537
AES_KEY_SIZE_BITS = 256
AES_KEY_SIZE_BYTES = 32
AES_IV_SIZE_BYTES = 12
AES_TAG_SIZE_BITS = 128


@dataclass
class EncryptedMessage:
    ciphertext: str  # base64
    iv: str          # base64
    algorithm: str
    timestamp: int   # ms epoch
    senderId: str
    recipientId: str


@dataclass
class MessageEnvelope:
    id: str
    encrypted: EncryptedMessage
    signature: str


def _b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _b64decode(data: str) -> bytes:
    return base64.b64decode(data.encode("ascii"))


def generate_keypair() -> rsa.RSAPrivateKey:
    """Generate RSA-4096 keypair matching WebCrypto RSA-OAEP / SHA-256."""
    return rsa.generate_private_key(
        public_exponent=RSA_PUBLIC_EXPONENT,
        key_size=RSA_KEY_SIZE,
    )


def export_public_key_jwk(private_key: rsa.RSAPrivateKey) -> dict:
    """Export public key as JWK matching WebCrypto exportKey('jwk', ...)."""
    public_numbers = private_key.public_key().public_numbers()
    n_bytes = public_numbers.n.to_bytes((public_numbers.n.bit_length() + 7) // 8, "big")
    e_bytes = public_numbers.e.to_bytes((public_numbers.e.bit_length() + 7) // 8, "big")
    return {
        "kty": "RSA",
        "alg": "RSA-OAEP-256",
        "use": "enc",
        "key_ops": ["encrypt"],
        "ext": True,
        "n": base64.urlsafe_b64encode(n_bytes).decode("ascii").rstrip("="),
        "e": base64.urlsafe_b64encode(e_bytes).decode("ascii").rstrip("="),
    }


def import_public_key_jwk(jwk: dict) -> rsa.RSAPublicKey:
    """Import public key from JWK matching WebCrypto importKey('jwk', ...)."""
    def _b64url_pad(s: str) -> bytes:
        padded = s + "=" * ((4 - len(s) % 4) % 4)
        return base64.urlsafe_b64decode(padded.encode("ascii"))

    n = int.from_bytes(_b64url_pad(jwk["n"]), "big")
    e = int.from_bytes(_b64url_pad(jwk["e"]), "big")
    return rsa.RSAPublicNumbers(e, n).public_key()


def encrypt_message(
    plaintext: str,
    sender_id: str,
    recipient_id: str,
    recipient_public_key: rsa.RSAPublicKey,
) -> MessageEnvelope:
    """Encrypt with hybrid RSA-OAEP + AES-256-GCM.

    Wire format matches frontend: AES key wrapped via RSA-OAEP/SHA-256, then
    {wrapped_key || ciphertext_with_tag} concatenated and base64'd into ciphertext.
    """
    # Generate ephemeral AES-256-GCM key + 12-byte IV
    aes_key = os.urandom(AES_KEY_SIZE_BYTES)
    iv = os.urandom(AES_IV_SIZE_BYTES)

    # AES-GCM encrypt — output includes 16-byte tag appended to ciphertext
    aesgcm = AESGCM(aes_key)
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)

    # RSA-OAEP wrap the AES key (must use SHA-256, MGF1-SHA-256 to match WebCrypto)
    wrapped_key = recipient_public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    # Wire format: [4-byte big-endian wrapped-key length][wrapped_key][ciphertext+tag]
    wrapped_len = len(wrapped_key).to_bytes(4, "big")
    blob = wrapped_len + wrapped_key + ciphertext_with_tag

    encrypted = EncryptedMessage(
        ciphertext=_b64encode(blob),
        iv=_b64encode(iv),
        algorithm="RSA-OAEP+AES-GCM",
        timestamp=int(time.time() * 1000),
        senderId=sender_id,
        recipientId=recipient_id,
    )

    # Signature placeholder — Phase 4.1.c adds HMAC-SHA256 over the envelope
    signature = ""

    return MessageEnvelope(
        id=str(uuid4()),
        encrypted=encrypted,
        signature=signature,
    )


def decrypt_message(
    envelope: MessageEnvelope,
    recipient_private_key: rsa.RSAPrivateKey,
) -> str:
    """Decrypt envelope produced by encrypt_message or the frontend equivalent."""
    blob = _b64decode(envelope.encrypted.ciphertext)
    iv = _b64decode(envelope.encrypted.iv)

    wrapped_len = int.from_bytes(blob[:4], "big")
    wrapped_key = blob[4:4 + wrapped_len]
    ciphertext_with_tag = blob[4 + wrapped_len:]

    aes_key = recipient_private_key.decrypt(
        wrapped_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    aesgcm = AESGCM(aes_key)
    plaintext = aesgcm.decrypt(iv, ciphertext_with_tag, None)
    return plaintext.decode("utf-8")


def envelope_to_dict(envelope: MessageEnvelope) -> dict:
    return {
        "id": envelope.id,
        "encrypted": asdict(envelope.encrypted),
        "signature": envelope.signature,
    }


def envelope_from_dict(data: dict) -> MessageEnvelope:
    enc = data["encrypted"]
    return MessageEnvelope(
        id=data["id"],
        encrypted=EncryptedMessage(**enc),
        signature=data.get("signature", ""),
    )
