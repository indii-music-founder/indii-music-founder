# Gemini Enterprise Agent Schema & DSP Mapping Skill (indiiOS)

Standards for transforming unstructured multimodal inputs into indiiOS Layer 1 Firestore models, DDEX ERN compliance objects, and DSP safety verifications.

## Firestore Collection Mappings

### 1. `releases/{releaseId}`
```typescript
interface FirestoreReleaseRecord {
  id: string;
  title: string;
  artistId: string;
  releaseType: 'single' | 'ep' | 'album';
  status: 'draft' | 'pending_validation' | 'ready_for_distribution' | 'distributed';
  upc?: string;
  catalogNumber?: string;
  releaseDate: string; // ISO 8601
  tracks: Array<{
    id: string;
    title: string;
    isrc?: string;
    trackNumber: number;
    durationSeconds: number;
    explicit: boolean;
    audioRef: string; // Storage URI
    splitsRef?: string;
  }>;
  dspValidation: {
    passed: boolean;
    explicitFlagsMatched: boolean;
    titleConformsToDspStyleGuide: boolean;
    flaggedIssues: Array<{
      field: string;
      reason: string;
      severity: 'error' | 'warning';
    }>;
  };
}
```

### 2. `splits/{splitId}`
```typescript
interface FirestoreSplitAgreementRecord {
  id: string;
  releaseId: string;
  trackId?: string;
  totalMasterAllocated: number; // 100.00
  totalPublishingAllocated: number; // 100.00
  parties: Array<{
    userId?: string;
    legalName: string;
    stageName: string;
    email: string;
    masterShare: number;
    publishingShare: number;
    proAffiliation?: string;
    ipi?: string;
    confirmed: boolean;
  }>;
  escrowStatus: 'none' | 'holding' | 'disbursed';
  locked: boolean;
}
```

## DSP Style Guide & Compliance Heuristics
1. **Title Cleanliness:** Avoid generic descriptors in titles (e.g., "(Official Audio)", "Track 1", "(HQ)").
2. **Featured Artist Standard:** Format as `Main Artist feat. Guest Artist` or provide clean DDEX secondary artist roles.
3. **Explicit Lyrics Matching:** If lyrics contain profanity or explicit themes, `explicit: true` must be strictly enforced.
