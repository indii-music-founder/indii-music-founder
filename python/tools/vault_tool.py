from python.helpers.tool import Tool, Response
from python.helpers.vault import CredentialVault
import os

class VaultTool(Tool):
    """
    Agent Interface for the Credential Vault.
    Allows the agent to Request Access to secrets.
    """
    
    async def execute(self, action, service=None, username=None, password=None, bio_token=None, **kwargs):
        if not bio_token:
            return Response(message="❌ BIOMETRIC TOKEN REQUIRED. Please prompt user to unlock vault.", break_loop=True)

        try:
            vault = CredentialVault(bio_token)
            
            if action == "store":
                if not service or not username or not password:
                    return Response(message="Missing data for storage.", break_loop=False)
                
                vault.save_credentials(service, {"username": username, "password": password})
                return Response(message=f"✅ Credentials for {service} secured in Vault.", break_loop=False)
            
            elif action == "retrieve":
                creds = vault.get_credentials(service)
                if not creds:
                    return Response(message=f"No credentials found for {service}.", break_loop=False)
                
                # SENSITIVE: Never output password in plain text response log if possible
                # But the agent needs it to fill forms. We return it ephemerally.
                return Response(
                    message=f"Credentials retrieved for {service}.", 
                    break_loop=False,
                    additional={"creds": creds} # Passed in metadata, not chat text
                )
                
            else:
                return Response(message=f"Unknown vault action: {action}", break_loop=False)

        except PermissionError:
             return Response(message="⛔ ACCESS DENIED. Biometric token invalid.", break_loop=True)
        except Exception as e:
            return Response(message=f"Vault Error: {str(e)}", break_loop=False)
