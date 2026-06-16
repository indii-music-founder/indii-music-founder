# Founder Access Bypass — Tier Resolution Flowchart

## Overview

This flowchart documents the cascading bypass logic that grants the platform owner (`wiil@indii.music`) Founder-tier access across all enforcement layers in the membership system.

---

## Tier Resolution Flow

```mermaid
flowchart TD
    A["User logs in"] --> B["profileSlice.loadUserProfile(uid)"]
    B --> C{"Email in FOUNDER_EMAILS?"}
    C -->|Yes| D["Set membership.tier = 'founder' in Zustand"]
    C -->|No| E["Use profile as-is from Firestore"]
    D --> F["Store state ready"]
    E --> F

    F --> G["Agent/Feature requests resource"]
    G --> H["MembershipService.getCurrentTier()"]

    H --> I{"Firebase Auth email in FOUNDER_EMAILS?"}
    I -->|Yes| J["Return 'founder'"]
    I -->|No| K{"Store profile email in FOUNDER_EMAILS?"}
    K -->|Yes| J
    K -->|No| L{"isBuilderAccount() — god_mode claim?"}
    L -->|Yes| M["Return 'enterprise'"]
    L -->|No| N["Return org.plan or 'free'"]

    G --> O["MembershipService.checkBudget(cost)"]
    O --> P{"isBuilderAccount()?"}
    P -->|Yes| Q["Return allowed: true, budget: Infinity"]
    P -->|No| R["Enforce tier daily spend limit"]

    G --> S["MembershipService.checkQuota(type, amount)"]
    S --> T{"isBuilderAccount()?"}
    T -->|Yes| U["Return allowed: true, max: Infinity"]
    T -->|No| V["Enforce tier quota limits"]

    style J fill:#10b981,stroke:#059669,color:#fff
    style Q fill:#10b981,stroke:#059669,color:#fff
    style U fill:#10b981,stroke:#059669,color:#fff
    style D fill:#f59e0b,stroke:#d97706,color:#fff
```

## isBuilderAccount() Priority Chain

```mermaid
flowchart LR
    A["isBuilderAccount()"] --> B{"VITE_BYPASS_BUDGET_LIMITS=true?"}
    B -->|Yes| Z["✅ true"]
    B -->|No| C{"Email in FOUNDER_EMAILS?"}
    C -->|Yes| Z
    C -->|No| D{"god_mode custom claim?"}
    D -->|Yes| Z
    D -->|No| E["❌ false"]

    style Z fill:#10b981,stroke:#059669,color:#fff
    style E fill:#ef4444,stroke:#dc2626,color:#fff
```

## Enforcement Points

| Enforcement Layer | Method | Founder Behavior |
|---|---|---|
| **Tier Resolution** | `getCurrentTier()` | Returns `'founder'` — $500/day, 10TB, unlimited projects |
| **Budget Gate** | `checkBudget()` | `allowed: true`, `remainingBudget: Infinity` |
| **Quota Gate** | `checkQuota()` | `allowed: true`, `maxAllowed: Infinity` |
| **Agent Circuit Breaker** | `BaseAgent._executeInternal()` | Skipped — budget check passes |
| **Profile Tier** | `profileSlice.loadUserProfile()` | Auto-set to `'founder'` in Zustand |

## Files Modified

- `packages/renderer/src/services/MembershipService.ts` — Core bypass logic
- `packages/renderer/src/core/store/slices/profileSlice.ts` — Auto-grant on load
- `packages/renderer/src/types/User.ts` — Type union update
