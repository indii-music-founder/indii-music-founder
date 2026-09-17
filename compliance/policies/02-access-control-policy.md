# Access Control Policy (POL-002)

## 1. Purpose
This policy establishes access control standards to prevent unauthorized access to indii.music production infrastructure, source code, third-party integrations, and customer records.

## 2. Authentication Standards
- **Multi-Factor Authentication (MFA)**: MFA (TOTP or hardware security keys / WebAuthn) is strictly mandatory for all Google Workspace, Google Cloud Platform (GCP), GitHub, Cloudflare, Stripe, and Meta Developer accounts. Single-factor logins to administrative interfaces are strictly prohibited.
- **Password Complexity**: Passwords must be at least 16 characters long and generated using an approved password manager (1Password, Bitwarden, Apple Keychain).
- **Service Accounts & Keys**: Long-lived service account keys must be avoided. Workload Identity Federation or ephemeral Google OAuth tokens are preferred. Any generated credentials must be securely stored in Google Secret Manager.

## 3. Provisioning and Deprovisioning
- **Access Requests**: Access to production systems requires documented approval from the Founder / Lead Engineer.
- **Deprovisioning (Termination)**: Upon separation of an employee or contractor, access to all systems (Google Workspace, GitHub, GCP, Slack, 1Password) must be revoked within **8 hours**.

## 4. Remote Relay & Studio Executor Authorization
- The indii Remote Relay service and Studio Executor communication protocol require short-lived, cryptographically signed bearer tokens.
- Nonce tracking and short time-to-live (TTL <= 60 seconds) are enforced on remote execution payloads to prevent replay attacks.
- Local desktop daemons run with non-root user permissions.

## 5. Periodic Access Reviews
- A formal review of all GitHub organization members, GCP IAM roles, and third-party administrative privileges is conducted **quarterly**.
- Inactive or unnecessary privileges are revoked immediately upon discovery.

*Approved by Leadership: 2026-09-17*
