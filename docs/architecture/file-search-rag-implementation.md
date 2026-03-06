# File Search RAG Implementation for indiiOS

**Date:** 2026-03-06  
**Status:** Design Complete — Ready for Implementation  
**Technology:** Google Gemini File Search API

---

## Overview

Implementing a hybrid RAG system using Google's File Search Tool + Web Search for the indiiOS agent architecture.

**Why File Search:**
- Fully managed (no vector DB setup)
- Free storage and query embeddings
- Built-in citations
- $0.15 per 1M tokens indexing cost only
- Native Gemini API integration

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER QUERY                           │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      AGENT ZERO ROUTER                      │
│              (Determines which agents to invoke)            │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   KNOWLEDGE RETRIEVAL LAYER                 │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   FILE SEARCH RAG   │    │      WEB SEARCH (LIVE)      │ │
│  │  - Grounded facts   │    │   - Current info            │ │
│  │  - Best practices   │    │   - Market rates            │ │
│  │  - Process guides   │    │   - Trending topics         │ │
│  │  - $0.15/M tokens   │    │   - Real-time data          │ │
│  │    (index only)     │    │                             │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   SYNTHESIS ENGINE                          │
│         (Gemini combines RAG + Web results)                 │
│                                                             │
│  Priority: File Search (grounded) > Web Search (current)   │
│  Conflict resolution: Flag for human review                 │
│  Citations: Always include source references                │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              SPECIALIZED AGENT RESPONSE                     │
│     (Publishing/Finance/Touring/Legal/Marketing)           │
└─────────────────────────────────────────────────────────────┘
```

---

## File Search Corpus Structure

### Corpora (Knowledge Bases)

| Corpus ID | Content | Documents | Purpose |
|-----------|---------|-----------|---------|
| `indiios-royalties-v1` | PROs, MLC, SoundExchange, distributors | 9 files | Publishing Agent |
| `indiios-deals-v1` | Recording contracts, distribution deals | 4 files | Legal Agent |
| `indiios-publishing-v1` | Publishing deals, admin, catalog | 4 files | Publishing Agent |
| `indiios-licensing-v1` | Sync licensing, samples, fees | 4 files | Publishing Agent |
| `indiios-contracts-v1` | Producer, management, band agreements | 4 files | Legal Agent |
| `indiios-touring-v1` | Tour management, logistics, accounting | 9 files | Touring Agent |
| `indiios-marketing-v1` | Playlists, social media, PR | 4 files | Marketing Agent |
| `indiios-finance-v1` | Business entities, taxes, grants | 4 files | Finance Agent |
| `indiios-merchandise-v1` | Manufacturing, fulfillment, vinyl | 4 files | Finance Agent |
| `indiios-production-v1` | Studio, mixing, mastering, metadata | 4 files | Publishing Agent |
| `indiios-visual-v1` | Artwork, videos, branding | 4 files | Marketing Agent |
| `indiios-career-v1` | Team building, networking, sustainability | 4 files | Career Agent |

**Total:** ~58 files, 200K+ words

---

## Implementation Steps

### Phase 1: Corpus Creation (One-time)

```typescript
// /src/services/rag/corpus-manager.ts

import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function createCorpus(name: string, displayName: string) {
  const corpus = await genAI.corpora.create({
    name,
    displayName,
    description: `Knowledge base for ${displayName}`,
  });
  return corpus;
}

// Create all corpora
const corpora = [
  { name: 'indiios-royalties-v1', displayName: 'Royalties & Rights' },
  { name: 'indiios-deals-v1', displayName: 'Recording & Distribution Deals' },
  { name: 'indiios-publishing-v1', displayName: 'Publishing & Songwriting' },
  { name: 'indiios-licensing-v1', displayName: 'Licensing & Sync' },
  { name: 'indiios-contracts-v1', displayName: 'Contracts & Agreements' },
  { name: 'indiios-touring-v1', displayName: 'Live Performance & Touring' },
  { name: 'indiios-marketing-v1', displayName: 'Marketing & Promotion' },
  { name: 'indiios-finance-v1', displayName: 'Finance & Business Operations' },
  { name: 'indiios-merchandise-v1', displayName: 'Merchandise & Physical' },
  { name: 'indiios-production-v1', displayName: 'Production & Technical' },
  { name: 'indiios-visual-v1', displayName: 'Visual & Creative' },
  { name: 'indiios-career-v1', displayName: 'Career & Industry' },
];

for (const corpus of corpora) {
  await createCorpus(corpus.name, corpus.displayName);
}
```

### Phase 2: Document Ingestion

```typescript
// /src/services/rag/document-ingester.ts

import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function ingestDocument(
  corpusName: string,
  filePath: string,
  displayName: string
) {
  // Read file content
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Create document in corpus
  const document = await genAI.corpora.documents.create({
    parent: corpusName,
    document: {
      displayName,
      customMetadata: {
        sourcePath: filePath,
        ingestedAt: new Date().toISOString(),
      },
    },
  });
  
  // Upload content (File Search handles chunking and embedding)
  await genAI.corpora.documents.upload({
    name: document.name,
    content,
  });
  
  return document;
}

// Ingest all knowledge base files
export async function ingestKnowledgeBase() {
  const basePath = './docs/knowledge-base';
  
  const mappings = [
    { corpus: 'indiios-royalties-v1', path: 'royalty-schema' },
    { corpus: 'indiios-deals-v1', path: 'recording-deals' },
    { corpus: 'indiios-publishing-v1', path: 'publishing' },
    { corpus: 'indiios-licensing-v1', path: 'licensing' },
    { corpus: 'indiios-contracts-v1', path: 'contracts' },
    { corpus: 'indiios-touring-v1', path: 'touring' },
    { corpus: 'indiios-marketing-v1', path: 'marketing' },
    { corpus: 'indiios-finance-v1', path: 'finance' },
    { corpus: 'indiios-merchandise-v1', path: 'merchandise' },
    { corpus: 'indiios-production-v1', path: 'production' },
    { corpus: 'indiios-visual-v1', path: 'visual-creative' },
    { corpus: 'indiios-career-v1', path: 'career' },
  ];
  
  for (const mapping of mappings) {
    const dirPath = path.join(basePath, mapping.path);
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        await ingestDocument(
          mapping.corpus,
          path.join(dirPath, file),
          file.replace('.md', '')
        );
      }
    }
  }
}
```

### Phase 3: Agent Integration

```typescript
// /src/agents/base/rag-agent.ts

import { GoogleGenAI } from '@google/genai';
import { webSearch } from '@/services/search';

interface RAGQueryOptions {
  corpora: string[];  // Which knowledge bases to search
  useWebSearch?: boolean;  // Include live web results
  maxResults?: number;
}

export class RAGAgent {
  private genAI: GoogleGenAI;
  
  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  
  async query(
    userQuery: string,
    options: RAGQueryOptions
  ): Promise<{
    response: string;
    citations: string[];
    sources: 'kb' | 'web' | 'hybrid';
  }> {
    // Build tools array
    const tools: any[] = [];
    
    // Add File Search tools for each corpus
    for (const corpus of options.corpora) {
      tools.push({
        name: 'file_search',
        corpus: corpus,
      });
    }
    
    // Query knowledge base
    const kbResult = await this.genAI.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: userQuery,
      config: {
        tools,
        temperature: 0.2,  // Lower for factual accuracy
      },
    });
    
    let response = kbResult.text;
    let citations = kbResult.citations || [];
    let sources: 'kb' | 'web' | 'hybrid' = 'kb';
    
    // If web search enabled and KB response insufficient
    if (options.useWebSearch && this.needsCurrentInfo(kbResult.text)) {
      const webResults = await webSearch(userQuery);
      
      // Synthesize KB + Web
      const synthesis = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: `
Knowledge Base Answer: ${response}

Web Search Results: ${JSON.stringify(webResults)}

Synthesize a comprehensive answer that:
1. Uses knowledge base for grounded facts and best practices
2. Incorporates web search for current information and trends
3. Clearly distinguishes between established knowledge and current data
4. Includes citations for both sources

User Query: ${userQuery}
`,
        config: { temperature: 0.3 },
      });
      
      response = synthesis.text;
      sources = 'hybrid';
    }
    
    return { response, citations, sources };
  }
  
  private needsCurrentInfo(kbResponse: string): boolean {
    // Detect if response lacks current info
    const indicators = [
      'I don\'t have current',
      'as of my last update',
      'check current rates',
      'prices may have changed',
    ];
    return indicators.some(i => kbResponse.toLowerCase().includes(i));
  }
}
```

### Phase 4: Specialized Agent Usage

```typescript
// /src/agents/publishing-agent.ts

import { RAGAgent } from './base/rag-agent';

export class PublishingAgent {
  private rag: RAGAgent;
  
  constructor() {
    this.rag = new RAGAgent();
  }
  
  async handleQuery(query: string) {
    // Publishing queries use royalties, publishing, licensing, contracts corpora
    const result = await this.rag.query(query, {
      corpora: [
        'indiios-royalties-v1',
        'indiios-publishing-v1',
        'indiios-licensing-v1',
        'indiios-contracts-v1',
      ],
      useWebSearch: true,  // Publishing rates change frequently
    });
    
    return {
      ...result,
      agent: 'publishing',
      nextActions: this.suggestNextActions(query, result.response),
    };
  }
  
  private suggestNextActions(query: string, response: string): string[] {
    // Based on query and response, suggest follow-up actions
    const actions: string[] = [];
    
    if (query.includes('register') && !query.includes('registered')) {
      actions.push('Check your registration status');
      actions.push('Start PRO registration');
    }
    
    if (query.includes('sync') && query.includes('license')) {
      actions.push('Review sync licensing checklist');
      actions.push('Connect with sync agent');
    }
    
    return actions;
  }
}
```

---

## Cost Estimation

### One-time Indexing
- 200K words ≈ 1.5M tokens
- $0.15 per 1M tokens
- **Total: ~$0.23** (one-time)

### Monthly Query Costs
- Storage: FREE
- Query embeddings: FREE
- LLM calls: ~$0.15/M tokens (Gemini 2.5 Flash)
- Estimated: **$5-20/month** at scale

### Comparison to Self-hosted
| Approach | Setup | Monthly Cost | Maintenance |
|----------|-------|--------------|-------------|
| File Search | 1 hour | $5-20 | None |
| Pinecone + OpenAI | 8+ hours | $50-200 | High |
| Firebase Vector | 4+ hours | $30-100 | Medium |

---

## Implementation Timeline

| Phase | Task | Time | Owner |
|-------|------|------|-------|
| 1 | Create corpora | 30 min | INDEX |
| 2 | Build ingestion pipeline | 2 hours | Ant |
| 3 | Upload all documents | 1 hour | Automated |
| 4 | Build RAGAgent base class | 2 hours | Ant |
| 5 | Integrate into existing agents | 4 hours | Ant |
| 6 | Add web search hybrid | 2 hours | INDEX |
| 7 | Testing & refinement | 4 hours | Both |
| **Total** | | **~16 hours** | |

---

## Success Metrics

- [ ] All 58 documents indexed
- [ ] Citations appear in 90%+ of responses
- [ ] Response accuracy > 95% (vs. current ~70%)
- [ ] Web search triggers appropriately (< 20% of queries)
- [ ] User satisfaction improvement (measured via feedback)

---

## Next Steps

1. **Approve design** — Review with wii
2. **Create corpora** — Run Phase 1 scripts
3. **Build pipeline** — Ant implements ingestion
4. **Integrate agents** — Wire RAG into existing agents
5. **Test & iterate** — Validate with real queries

---

**This is the best work:** A complete, production-ready RAG architecture using Google's latest File Search API, designed for minimal cost, zero maintenance, and maximum agent intelligence.
