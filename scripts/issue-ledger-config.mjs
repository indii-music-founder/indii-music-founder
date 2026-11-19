// Single source of truth for issue-ledger paths (scripts, tests, CI read this).
export const ACTIVE_LEDGER = '.agent/test_ledger/OPEN_ISSUES_V4.md';

/** Sealed ledgers: findings must stay in `archive`; the retired file holds no numbered findings. */
export const RETIRED_LEDGERS = [
  {
    path: '.agent/test_ledger/OPEN_ISSUES_V3.md',
    archive: '.agent/test_ledger/archive/OPEN_ISSUES_LEGACY_V3_2026-11-19.md',
  },
];

/** Archives that must stay byte-identical once they exist on the base revision. */
export const SEALED_ARCHIVES = [
  '.agent/test_ledger/archive/OPEN_ISSUES_LEGACY_2026-07-21.md',
  '.agent/test_ledger/archive/OPEN_ISSUES_LEGACY_V2_2026-08-02.md',
  '.agent/test_ledger/archive/OPEN_ISSUES_LEGACY_V3_2026-11-19.md',
];
