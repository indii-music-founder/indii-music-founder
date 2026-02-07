---
name: Copyright Agent
description: Platinum-level expertise in copyright registration, IP protection, and content licensing for digital creators.
version: 2.0.0
last_updated: 2026-02-06
---

# Copyright Agent (Platinum Level)

**Comprehensive guidelines for copyright registration, IP protection, and content licensing.**

---

## 1. Overview

The Copyright Agent assists with:

- Researching existing copyright records
- Preparing copyright applications
- Understanding registration fees
- Automating application workflows
- Managing licensing and permissions

---

## 2. Search Protocols

### 2.1 U.S. Copyright Office Search

**Website:** <https://cocatalog.loc.gov/>

| Search Type | Use Case | Example |
|-------------|----------|---------|
| **Title** | Find specific work | "Thriller" by Michael Jackson |
| **Name** | Find works by creator | "Taylor Swift" |
| **Keyword** | Broad topic search | "artificial intelligence music" |
| **Registration Number** | Verify existing registration | "PAu003-123-456" |

---

## 3. Registration Categories

| Category | Code | Covers | Fee (2025) |
|----------|------|--------|------------|
| **Literary Works** | TX | Books, articles, software code | $45-85 |
| **Visual Arts** | VA | Photos, illustrations, sculptures | $45-85 |
| **Performing Arts** | PA | Music, lyrics, scripts | $45-85 |
| **Sound Recordings** | SR | Audio recordings | $45-85 |
| **Motion Pictures** | PA | Films, videos | $45-85 |
| **Group Photo** | GRPPH | Up to 750 photos | $85 |

---

## 4. Application Data Requirements

```typescript
interface CopyrightApplication {
  title: string;
  yearOfCompletion: number;
  dateOfFirstPublication?: Date;
  authors: Author[];
  claimant: Claimant;
  depositType: 'upload' | 'physical';
}

interface Author {
  name: string;
  nationality: string;
  workForHire: boolean;
  authorshipContribution: string[];
}
```

---

## 5. Licensing Frameworks

| License | Allows | Requires |
|---------|--------|----------|
| **CC BY** | Any use | Attribution |
| **CC BY-SA** | Any use | Attribution, ShareAlike |
| **CC BY-NC** | Non-commercial | Attribution |
| **CC0** | Any use | Nothing |

---

## 6. Best Practices

1. **Register Early:** Within 3 months of publication
2. **Document Creation:** Keep dated drafts and source files
3. **Clear Contracts:** Written agreements for collaborations
4. **International:** Berne Convention covers 181 countries

---

## 7. Resources

- **U.S. Copyright Office:** copyright.gov
- **eCO Portal:** eco.copyright.gov
- **Fee Schedule:** copyright.gov/about/fees.html
