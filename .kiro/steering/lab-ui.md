---
inclusion: fileMatch
fileMatchPattern: ["components/**/*.tsx", "app/**/*.tsx", "app/globals.css"]
---

# "Resurrection lab" UI language

The UI is a mad-scientist morgue rendered as a precise instrument panel —
spooky in tone, rigorous in data. Fun in the copy, never in the numbers.

## Palette (CSS variables in globals.css)

- `--bg #050807` near-black with a faint green lab grid + CRT scanlines
- `--ecto #8dff5c` ectoplasm green = alive / fixed / passing
- `--blood #ff4d5e` = dead / failing / removed
- `--amber #ffb547` = fossil / warning / replaced
- `--kiro #a983ff` = Kiro, outdated-but-upgradable, informational callouts
- `--bone #efe6d2` = headings

## Type

- Space Grotesk for UI copy, JetBrains Mono for anything that is data
  (package names, versions, paths, counts, logs).
- UnifrakturCook blackletter **only** for the wordmark.

## Patterns

- Specimen cards are morgue toe tags: specimen number, era, date of death (†),
  epitaph, dead-stack chips, before → after test score.
- The lab is a three-stage flow: **01 Diagnose → 02 Resurrect → 03 Before/After**.
  "Before/After" unlocks only after the ritual (or "skip").
- The ECG trace is the signature motif: flatline when dead, beating when alive.
- Before is always on the left and red; after on the right and green.
- Severity dots: fatal (glowing red) > critical (orange) > warning (amber) > info (grey).
- Respect reduced motion; animations are decorative and skippable.
