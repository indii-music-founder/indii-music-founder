import os
import time
import json
from python.helpers.vault import CredentialVault

class SecureLogger:
    """
    Task 7: Audit Log Encryption.
    Encrypts agent action logs at rest using the Vault cipher.
    Logs are only readable when the Biometric Token is active.
    """
    
    LOG_DIR = os.path.join(os.getcwd(), "audit_logs")
    
    def __init__(self, bio_token):
        if not os.path.exists(self.LOG_DIR):
            os.makedirs(self.LOG_DIR, exist_ok=True)
            
        # Re-use the Vault's encryption logic (AES-256)
        # In a real impl, we might separate keys, but this proves the pattern.
        self.vault = CredentialVault(bio_token)
        
    def log(self, action, details):
        entry = {
            "timestamp": time.time(),
            "action": action,
            "details": details
        }
        
        # 1. JSON Serialize
        data = json.dumps(entry).encode()
        
        # 2. Encrypt
        encrypted_data = self.vault.cipher.encrypt(data)
        
        # 3. Append to Log
        # We append as line-delimited Base64 strings
        log_file = os.path.join(self.LOG_DIR, f"audit_{time.strftime('%Y%m%d')}.enc")
        with open(log_file, "ab") as f:
            f.write(encrypted_data + b"\n")
            
    def read_logs(self, date_str):
        """Decrypts logs for a specific date (YYYYMMDD)."""
        log_file = os.path.join(self.LOG_DIR, f"audit_{date_str}.enc")
        if not os.path.exists(log_file):
            return []
            
        entries = []
        with open(log_file, "rb") as f:
            for line in f:
                try:
                    decrypted = self.vault.cipher.decrypt(line.strip())
                    entries.append(json.loads(decrypted))
                except:
                    entries.append({"error": "Decryption Failed"})
        return entries
