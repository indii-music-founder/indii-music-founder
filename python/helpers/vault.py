import os
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

class CredentialVault:
    """
    Task 2: Credential Vault Biometrics (Backend Logic).
    Handles AES-256 encryption/decryption of secrets (ASCAP/BMI passwords).
    The 'master_key' is never stored; it must be provided by the Electron
    Biometric Bridge at runtime (Ephemeral Access).
    """
    
    VAULT_PATH = os.path.join(os.getcwd(), "secure_vault.enc")
    
    def __init__(self, master_key_material: str):
        self.master_key_material = master_key_material

    def _get_cipher(self, salt: bytes):
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key_material.encode()))
        return Fernet(key)

    def save_credentials(self, service: str, data: dict):
        """Encrypts and saves credentials to the vault."""
        vault_data = self._load_vault()
        vault_data[service] = data
        
        salt = os.urandom(16)
        cipher = self._get_cipher(salt)
        
        # Encrypt the entire vault blob
        encrypted = cipher.encrypt(json.dumps(vault_data).encode())
        with open(self.VAULT_PATH, "wb") as f:
            f.write(salt + encrypted)
            
    def get_credentials(self, service: str):
        """Decrypts and retrieves credentials for a specific service."""
        vault_data = self._load_vault()
        return vault_data.get(service)

    def _load_vault(self):
        if not os.path.exists(self.VAULT_PATH):
            return {}
        
        with open(self.VAULT_PATH, "rb") as f:
            data = f.read()
            if len(data) < 16:
                return {}
            salt = data[:16]
            encrypted = data[16:]
            
        try:
            cipher = self._get_cipher(salt)
            decrypted = cipher.decrypt(encrypted)
            return json.loads(decrypted)
        except Exception:
            # If decryption fails, the key (biometric token) was wrong
            raise PermissionError("Access Denied: Biometric Key Mismatch")
