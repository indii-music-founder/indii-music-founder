# Risk Assessment Methodology & Scoring Matrix

## 1. Overview
indii.music evaluates operational, technical, and regulatory risks based on a standard 5x5 Likelihood vs. Impact scoring matrix.

## 2. Likelihood Criteria
1. **Rare**: Unlikely to occur; requires complex chain of events or zero-day exploit.
2. **Unlikely**: Possible, but controls and mitigations make occurrence infrequent.
3. **Moderate**: Has occurred in similar systems; plausible within a 12-month period.
4. **Likely**: Highly probable without active intervention.
5. **Almost Certain**: Expected to occur continuously or has already occurred repeatedly.

## 3. Impact Criteria
1. **Insignificant**: Negligible operational impact; no confidential data affected.
2. **Minor**: Transient internal disruption; non-confidential data; no customer downtime.
3. **Moderate**: Limited customer downtime (<2 hrs); minor reputational exposure; non-critical API failure.
4. **Major**: Partial artist data exposure; extended downtime (>4 hrs); regulatory notification required.
5. **Catastrophic**: Master unreleased music breach; complete data loss; permanent loss of trust.

## 4. Scoring & Action Thresholds
- **Score (1-25) = Likelihood (1-5) x Impact (1-5)**
- **Low (1-6)**: Acceptable residual risk; monitor annually.
- **Medium (8-12)**: Implement standard mitigations within 90 days.
- **High (15-19)**: Expedited engineering remediation required within 30 days.
- **Critical (20-25)**: Immediate leadership intervention; stop ship until mitigated.
