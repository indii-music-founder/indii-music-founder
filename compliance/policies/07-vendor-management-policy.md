# Vendor Management Policy (POL-007)

## 1. Purpose
To govern the assessment, selection, onboarding, and ongoing monitoring of third-party vendors and cloud service providers that handle indii.music data or provide critical infrastructure.

## 2. Vendor Classification & Risk Tiers
- **Tier 1 - Critical Infrastructure & Data Custodians**: Providers hosting production compute, customer databases, artist media, or authentication (e.g. Google Cloud, Firebase, GitHub).
- **Tier 2 - Critical Integrations & API Partners**: Providers with OAuth access or business transaction handling (e.g. Meta, Stripe, Spotify/Apple Music APIs).
- **Tier 3 - Operational & Productivity Tools**: Slack, Google Workspace, project management.

## 3. Due Diligence & Annual Review Requirements
- Prior to onboarding and annually thereafter, Tier 1 and Tier 2 vendors must provide:
  1. A current SOC 2 Type II report, ISO 27001 certificate, or independent security attestation.
  2. Data processing addendum (DPA) incorporating Standard Contractual Clauses (SCCs).
  3. Evidence of encryption in transit and at rest.
- The Founder reviews the vendor risk registry annually.

*Approved by Leadership: 2026-09-17*
