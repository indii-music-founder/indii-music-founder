import os
import re

def fix_readme():
    path = 'README.md'
    with open(path, 'rb') as f:
        content_bytes = f.read()
    
    # Try multiple decodings or just treat as bytes and find line numbers
    lines = content_bytes.split(b'\n')
    
    start_line = -1
    end_line = -1
    
    for i, line in enumerate(lines):
        if b'3-Layer Architecture' in line:
            start_line = i
        if b'indiiREMOTE Edge Infrastructure' in line:
            end_line = i
            break
            
    if start_line != -1 and end_line != -1:
        # Rebuild the file
        head = b'\n'.join(lines[:start_line+1]) + b'\n\nTo ensure 99.9% reliability in probabilistic AI workflows, indii operates on a rigorous 3-layer system:\n\n'
        
        layer_section = """```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: DIRECTIVE (Managerial)                             │
│  Natural language SOPs that define goals and safety bounds   │
│  → directives/                                               │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: ORCHESTRATION (Intelligence)                       │
│  A2A swarm protocol — reasons, routes, manages               │
│  → agents/ + src/services/agent/                             │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: EXECUTION (Deterministic)                          │
│  Hard-coded scripts for API calls, file ops, Proprietary Ingestion IP generation  │
│  → execution/ + python/tools/                                │
└──────────────────────────────────────────────────────────────┘

**The Multiplier Effect:** By pushing complexity into deterministic execution layers, we avoid the "compound error" trap (where 90% accuracy over 5 biological steps leads to 59% overall success). Determinism at the base allows for reliability at the peak.

**Omni-Aware Routing:** The orchestration layer is built with "Context-First" routing. Agents intelligently prioritize current conversation intent and user specific requests over the active document, preventing target collisions and ensuring a focused execution loop even in complex, multi-file workspaces.

---

## 🤖 indii: The A2A Swarm Protocol

The core of indii is the **Agent Swarm**, a decentralized orchestration protocol with **20 specialist agents** seeded with verifiable technical tools.

```
              ┌─────────────────────┐
              │indii Conductor (Swarm)│
              │    Orchestrator     │
              └──────────┬──────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │        │        │        │        │      │
  Creative  Brand   Music   Legal   Finance  Video
  Director  Agent   Agent   Agent   Agent   Agent
    │
  ┌─┴──────────────────────────────────────────┐
  Marketing  Social  Publishing  Licensing     │
  Agent      Agent   Agent       Agent         │
  │                                             │
  Publicist  Road    Generalist  Executor      │
  Agent      Agent   Agent       Agent         │
  │                                             │
  Merch      Analytics  IndiiOD  Strategy      │
  Agent      Agent      Agent    Agent         │
  └────────────────────────────────────────────┘
```

| Agent | Domain | Technical Core (Seeded Tools) |
|-------|--------|-------------------------------|
| **indii Conductor** | Swarm Orchestrator | Foundational Audit & Memory Skills |
| **Music Agent** | Audio Intelligence | `calculate_splits.py`, BPM/Key analysis |
| **Merchandise** | E-commerce Ops | `margin_calculator.py`, SKU generation |
| **Legal Agent** | Rights & Contracts | `nda_generator.py`, Contract Risk Audit |
| **Social Agent** | Social Media | `post_formatter.py`, Engagement optimization |
| **Finance Agent** | Revenue | `royalty_estimator.py`, Waterfall splits |
| **Creative Dir** | Visual Identity | Brand kit enforcement, Image synthesis |
| **Video Agent** | Video Production | Veo 3.1 synthesis, Director's Cut QA |
| **Analytics Agent**| Growth | Viral scoring, Breakout prediction |
| **All Others (11)** | Various | `domain_readiness.py` (Seeding ongoing) |

**Foundational Skills:**
- **Audit Skill**: Decentralized capability discovery via `scan_directory.py`.
- **Memory Skill**: Persistent procedural "Brain Surgery" via `update_knowledge.py`.
- **Capability Registry**: Centralized `agents/capability_registry.json` for tool discovery.

---
"""
        tail = b'\n'.join(lines[end_line:])
        
        final_content = head + layer_section.encode('utf-8') + b'\n' + tail
        
        with open(path, 'wb') as f:
            f.write(final_content)
        print(f"Success: Repaired README.md at lines {start_line}-{end_line}")
    else:
        print(f"Error: Markers not found. Start: {start_line}, End: {end_line}")

if __name__ == "__main__":
    fix_readme()
