---
name: Annual Career Review
description: SOP for the Career Analyst agent to generate a comprehensive year-in-review report for the artist.
---

# Annual Career Review — Agent Directive

## Purpose

Generate a comprehensive **Year-in-Review** report for the artist, covering all dimensions of their career. This report serves as:

1. A performance scorecard (what happened this year)
2. A strategic compass (what to focus on next year)
3. A legal/financial audit prompt (what needs attention)

## Trigger

- **Automatic:** December 1st of each year (via scheduled Cloud Function)
- **Manual:** Artist requests via Command Bar → "Generate Annual Review"

## Data Sources

The agent MUST query these services to compile the report:

```typescript
import { CareerMemoryArchiveService } from '@/services/memory/CareerMemoryArchiveService';
import { ISWCService } from '@/services/publishing/ISWCService';

// 1. Get all career memories for the year
const yearData = await CareerMemoryArchiveService.generateYearInReviewData(2026);

// 2. Get registered compositions
const works = await ISWCService.getByArtist();

// 3. Pull financial summaries from Firestore
// Collection: financial_summaries, filtered by year

// 4. Pull release data
// Collection: releases, filtered by releaseDate within year

// 5. Pull contract events
// Collection: career_events, where type === 'contract_signed'
```

## Report Sections

### 1. Release Recap

- Total releases (Singles, EPs, Albums)
- ISRCs assigned
- Genres/subgenres explored
- AI disclosure breakdown (Human_Created vs AI_Assisted vs AI_Generated)

### 2. Financial Performance

- Total revenue (streaming, downloads, sync, merch)
- Revenue by distributor
- Top-earning release
- Outstanding royalties / split sheet settlements
- Year-over-year growth %

### 3. Publishing & Composition

- New works registered (ISWC count)
- PRO registration status (ASCAP/BMI/SESAC)
- Publisher relationships
- Unregistered compositions (action items)

### 4. Legal & Contracts

- Contracts signed (via PandaDoc)
- LODs issued
- Sample clearances pending
- Rights disputes (if any)

### 5. Distribution Health

- Platform coverage (territories)
- DDEX delivery success rate
- Takedown/rejection count
- AI compliance status (2026 tags)

### 6. Strategic Milestones

- Top 5 career moments (by importance score)
- Goals met vs. goals missed
- Key industry relationships formed

### 7. Recommendations for Next Year

Based on the data above, the agent SHOULD provide:

- 3 "Double Down" suggestions (what's working)
- 3 "Fix" suggestions (what's broken)
- 3 "Explore" suggestions (new opportunities)
- 1 "Sunset" suggestion (what to stop doing)

## Output Format

- **Primary:** Markdown document stored in `career_memory_archive` with category = 'milestone'
- **Secondary:** PDF export (via PandaDoc template)
- **Notification:** Push notification + email to artist when ready

## Agent Behavior Rules

1. **Factual only.** Every claim must cite a data source. No speculative revenue.
2. **Concise.** Each section max 5 bullet points unless the artist has 10+ releases.
3. **Actionable.** Every "Recommendation" must include a concrete next step.
4. **Tone.** Professional but encouraging. The artist is the CEO — treat them as such.
5. **Privacy.** Never include raw financial figures in push notifications. Only in the full report.

## Error Handling

- If financial data is incomplete: Flag in report, don't guess.
- If no releases this year: Focus on publishing, legal, and strategic planning.
- If < 5 career memories exist: Suggest the artist start logging key moments.
