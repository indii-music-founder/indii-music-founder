# Vendor Security Review Procedure

## 1. Objective
To verify that every third-party software provider, SaaS tool, and infrastructure partner interacting with indii.music systems adheres to rigorous data security and privacy standards.

## 2. Review Triggers
1. **Pre-Onboarding**: Prior to signing contracts or integrating third-party SDKs/APIs into production.
2. **Annual Cadence**: Re-evaluation of all Tier 1 and Tier 2 vendors.
3. **Major Architecture Shift**: Material change in data exchanged or scopes requested.

## 3. Review Checklist
- [ ] Review current SOC 2 Type II examination report (including bridge letter if report > 6 months old).
- [ ] Verify encryption standards: TLS 1.2+ in transit, AES-256 at rest.
- [ ] Execute Data Processing Addendum (DPA) with Standard Contractual Clauses (SCCs).
- [ ] Confirm incident notification SLA (<= 72 hours in event of security breach).
- [ ] Confirm zero-training guarantee on customer data for AI/ML providers.
