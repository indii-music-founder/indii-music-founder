"""Interop test harness for E2E encryption — Phase 0.7.

This harness validates two things:
1. Python-side round-trip (encrypt + decrypt within Python). Internal consistency.
2. Cross-language interop fixtures (TS-encrypted blob → Python decrypt, and vice versa).
   Fixtures are loaded from python/tests/fixtures/e2e_interop/ — produced by the
   matching Vitest harness in packages/renderer/src/services/security/.

Run with: pytest python/tests/test_e2e_encryption_interop.py -v

Per execution plan Phase 0.7: this file lands BEFORE Phase 4 encryption hookup.
Drift in algorithm parameters between WebCrypto and Python `cryptography` is a
session-killer (Risk #2) — this harness catches it on day 1.
"""

import json
import os
from pathlib import Path

import pytest

from python.helpers.e2e_encryption import (
    decrypt_message,
    encrypt_message,
    envelope_from_dict,
    envelope_to_dict,
    export_public_key_jwk,
    generate_keypair,
    import_public_key_jwk,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "e2e_interop"


# -------- Python-side round-trip --------

def test_python_roundtrip_short_message():
    """Encrypt + decrypt within Python — proves internal consistency."""
    sender_key = generate_keypair()
    recipient_key = generate_keypair()

    plaintext = "hello from python"
    envelope = encrypt_message(
        plaintext,
        sender_id="agent-a",
        recipient_id="agent-b",
        recipient_public_key=recipient_key.public_key(),
    )

    decrypted = decrypt_message(envelope, recipient_key)
    assert decrypted == plaintext


def test_python_roundtrip_unicode():
    """Verify UTF-8 encoding survives the round-trip."""
    recipient_key = generate_keypair()
    plaintext = "日本語 + emoji 🎵 + control \x00\x01\x02"
    envelope = encrypt_message(
        plaintext, "a", "b", recipient_key.public_key()
    )
    assert decrypt_message(envelope, recipient_key) == plaintext


def test_python_roundtrip_large_payload():
    """1 MB payload — exercises AES-GCM streaming, not just RSA."""
    recipient_key = generate_keypair()
    plaintext = "x" * (1024 * 1024)
    envelope = encrypt_message(
        plaintext, "a", "b", recipient_key.public_key()
    )
    assert decrypt_message(envelope, recipient_key) == plaintext


def test_envelope_serialization_roundtrip():
    """Envelope must survive JSON serialization (over-the-wire format)."""
    recipient_key = generate_keypair()
    envelope = encrypt_message(
        "wire format test", "a", "b", recipient_key.public_key()
    )

    wire = json.dumps(envelope_to_dict(envelope))
    restored = envelope_from_dict(json.loads(wire))

    assert decrypt_message(restored, recipient_key) == "wire format test"


def test_jwk_export_import_roundtrip():
    """Public key JWK export → import preserves the key."""
    keypair = generate_keypair()
    jwk = export_public_key_jwk(keypair)

    assert jwk["kty"] == "RSA"
    assert jwk["alg"] == "RSA-OAEP-256"
    assert "n" in jwk and "e" in jwk

    imported = import_public_key_jwk(jwk)
    # Encrypt with imported key, decrypt with original private key
    envelope = encrypt_message("jwk test", "a", "b", imported)
    assert decrypt_message(envelope, keypair) == "jwk test"


# -------- Cross-language interop (skipped until fixtures land) --------

@pytest.mark.skipif(
    not (FIXTURES_DIR / "ts_to_py").exists(),
    reason="TS→Py fixture not yet generated. Run frontend harness first.",
)
def test_decrypt_ts_encrypted_payload():
    """Decrypt a payload that was encrypted in TypeScript with WebCrypto.

    Frontend harness writes:
      fixtures/e2e_interop/ts_to_py/recipient_private_key.pem
      fixtures/e2e_interop/ts_to_py/envelope.json
      fixtures/e2e_interop/ts_to_py/expected_plaintext.txt
    """
    fixture_dir = FIXTURES_DIR / "ts_to_py"
    private_key_pem = (fixture_dir / "recipient_private_key.pem").read_bytes()
    envelope_json = json.loads((fixture_dir / "envelope.json").read_text())
    expected = (fixture_dir / "expected_plaintext.txt").read_text()

    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    private_key = load_pem_private_key(private_key_pem, password=None)

    envelope = envelope_from_dict(envelope_json)
    decrypted = decrypt_message(envelope, private_key)

    assert decrypted == expected, (
        "TS→Py decryption mismatch. WebCrypto / cryptography algorithm drift. "
        "Verify RSA-OAEP/SHA-256/4096 and AES-GCM/12-byte IV/128-bit tag."
    )


@pytest.mark.skipif(
    not (FIXTURES_DIR / "py_to_ts").exists(),
    reason="Py→TS fixture directory not yet present.",
)
def test_emit_python_encrypted_fixture():
    """Emit a Python-encrypted fixture for the frontend harness to decrypt.

    Frontend test (in Vitest) reads these and verifies decryption.
    """
    fixture_dir = FIXTURES_DIR / "py_to_ts"
    fixture_dir.mkdir(parents=True, exist_ok=True)

    # Recipient keypair — fixture must include both keys so the TS side has
    # the private key to decrypt with.
    from cryptography.hazmat.primitives.serialization import (
        BestAvailableEncryption,
        Encoding,
        NoEncryption,
        PrivateFormat,
    )

    keypair = generate_keypair()
    public_jwk = export_public_key_jwk(keypair)

    plaintext = "Python emitted this — decrypt me in TypeScript."
    envelope = encrypt_message(
        plaintext, "py-sender", "ts-recipient", keypair.public_key()
    )

    (fixture_dir / "recipient_public_jwk.json").write_text(json.dumps(public_jwk))
    (fixture_dir / "recipient_private_key.pem").write_bytes(
        keypair.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.PKCS8,
            encryption_algorithm=NoEncryption(),
        )
    )
    (fixture_dir / "envelope.json").write_text(
        json.dumps(envelope_to_dict(envelope), indent=2)
    )
    (fixture_dir / "expected_plaintext.txt").write_text(plaintext)


# -------- Algorithm parameter assertions (catch drift early) --------

def test_algorithm_constants_match_webcrypto():
    """These constants must match E2EEncryptionService.ts exactly."""
    from python.helpers import e2e_encryption as e2e

    assert e2e.RSA_KEY_SIZE == 4096, "Frontend uses modulusLength: 4096"
    assert e2e.RSA_PUBLIC_EXPONENT == 65537, "Frontend uses [1, 0, 1] = 65537"
    assert e2e.AES_KEY_SIZE_BITS == 256, "Frontend uses AES-GCM length: 256"
    assert e2e.AES_IV_SIZE_BYTES == 12, "WebCrypto AES-GCM standard IV is 96-bit"
    assert e2e.AES_TAG_SIZE_BITS == 128, "WebCrypto AES-GCM default tag is 128-bit"
