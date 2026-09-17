# Change Management Policy (POL-004)

## 1. Purpose
To ensure that changes to production software, infrastructure, and database configurations are introduced in a controlled, tested, and auditable manner.

## 2. Standard Change Workflow
All production changes must follow this linear lifecycle:
```
Issue / Feature Request 
  ↓
Local Branch & Implementation 
  ↓
Automated Unit, Integration & Security Tests 
  ↓
Pull Request with Clear Release Notes 
  ↓
Peer Review & Approval 
  ↓
Merge to Main (Branch Protection Enforced) 
  ↓
Automated CI/CD Build & Deployment 
  ↓
Immutable Deployment Audit Record
```

## 3. Branch Protection
- Direct pushes to `main` are strictly disabled via GitHub branch protection rules.
- Force pushing and branch deletion are permanently disabled.
- Merges require passing status checks from GitHub Actions.

## 4. Emergency Changes (Break-Glass Hotfixes)
- In the event of an active P0 incident, an expedited hotfix may be merged with founder authorization.
- The automated CI pipeline must still execute and pass.
- A retroactive review and postmortem documentation must be completed within 24 hours of release.

*Approved by Leadership: 2026-09-17*
