# Requirements — Resurrection lab UI

### Requirement 1 — Morgue (home)

1. THE SYSTEM SHALL show a GitHub input ("Exhume") and the bundled specimens as toe-tag cards with era, date of death, epitaph, dead-stack chips and the real before → after test score.
2. WHEN the user submits a repo THE SYSTEM SHALL navigate to `/exhume?repo=owner/name`.

### Requirement 2 — Diagnose

1. THE SYSTEM SHALL show the cause of death, four vitals (deps audited, dead/deprecated, breaking call sites, config fossils), the dependency graveyard table, config fossils, code findings with `file:line` and snippet, and the migration plan.

### Requirement 3 — Resurrect

1. WHEN the user presses **Resurrect** THE SYSTEM SHALL replay the pipeline phase by phase in a terminal with a phase checklist and an ECG that goes from flatline to heartbeat.
2. THE SYSTEM SHALL offer "Skip the incantation" and "Replay".
3. WHEN the ritual completes THE SYSTEM SHALL reveal the after-pulse and unlock Before/After.

### Requirement 4 — Before / After

1. WHEN verification evidence exists THE SYSTEM SHALL show legacy vs resurrected install, test and check results side by side and a per-case test board.
2. THE SYSTEM SHALL show every patch in a file list (M/+/−) with reasons and a split diff with folded unchanged regions.
3. THE SYSTEM SHALL let the user download the resurrected tree as a zip including `NECROPSY.md`.
4. WHEN no evidence exists (GitHub mode) THE SYSTEM SHALL say verification runs locally and how.
