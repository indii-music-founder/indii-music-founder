# Legal Contract & Split Sheet Extraction Skill (indiiOS)

Specialized extraction protocols and rules for music industry split sheets, producer agreements, work-for-hire contracts, and distribution agreements.

## Target Output Schema

When parsing legal agreements, extract into the following normalized structure:

```json
{
  "documentType": "split_sheet | producer_agreement | distribution_contract | work_for_hire | sync_license",
  "effectiveDate": "YYYY-MM-DD",
  "governingJurisdiction": "string",
  "work": {
    "title": "string",
    "isrc": "string | null",
    "iswc": "string | null"
  },
  "masterSplits": [
    {
      "contributorName": "string",
      "legalName": "string",
      "role": "primary_artist | featured_artist | producer | executive_producer | engineer",
      "percentage": 0.00,
      "payoutRecipient": "string",
      "recoupable": boolean
    }
  ],
  "publishingSplits": [
    {
      "writerName": "string",
      "ipiCaNumber": "string | null",
      "pro": "ASCAP | BMI | SESAC | PRS | GEMA | SOCAN | other",
      "publisherName": "string | null",
      "sharePercentage": 0.00,
      "writerShare": 0.00,
      "publisherShare": 0.00
    }
  ],
  "financialTerms": {
    "advanceUsd": 0.00,
    "producerRoyaltyPoints": 0.00,
    "recoupmentItems": ["recording_costs", "video_costs", "marketing"],
    "auditRights": boolean,
    "accountingFrequency": "monthly | quarterly | semi-annually"
  },
  "dspRestrictions": {
    "territories": ["Worldwide"] | ["US", "CA", ...],
    "exclusivityWindowDays": 0,
    "explicitContentDeclared": boolean
  },
  "unfavorableClausesOrRisks": [
    {
      "clause": "string",
      "riskLevel": "high | medium | low",
      "recommendation": "string"
    }
  ]
}
```

## Validation & Business Rules
1. **100% Invariant Check:** `masterSplits` sum must equal 100.00% (or flag exact delta). `publishingSplits` total must equal 100.00% (or 200% under 100/100 writer/publisher convention).
2. **Entity Disambiguation:** Distinguish between stage name, legal name, and corporate loan-out company.
3. **Producer Points vs Master Equity:** Explicitly distinguish between backend royalty points and underlying master ownership percentage.
