# Security Policy

## Supported Versions

Security fixes are applied to `main` and the latest tagged release.

## Reporting a Vulnerability

Do not open a public issue for suspected vulnerabilities, leaked credentials,
private keys, authentication bypasses, data exposure, or abuse paths.

Report security issues privately to `wiil@indii.music` with:

- A short description of the issue and affected surface area.
- Reproduction steps or proof-of-concept details.
- Any logs, screenshots, or request IDs that help verify the issue.
- Whether the vulnerability may already be exposed in production.

Reports are triaged as quickly as possible. Critical credential or data exposure
reports should be treated as immediate rotation and containment events.

## Secret Handling

Firebase client API keys are project identifiers, not privileged secrets. Server
credentials, service account material, private SSH keys, provider tokens, and
payment credentials must never be committed. Use local environment files or the
managed secret stores documented for the deployment target.
