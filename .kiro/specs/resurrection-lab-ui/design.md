# Design — Resurrection lab UI

- Server components render the morgue and specimen pages statically from
  `data/presets/*.json` (`generateStaticParams`), so specimen labs are instant
  and work without any backend.
- `/exhume` is a client page that calls `GET /api/resurrect?repo=` (Node
  runtime, 60 s max) and renders the same `<Lab>` with `verify: null`.
- `<Lab>` holds `stage` and `resurrected` state; `Ritual` builds its script
  from the report so the terminal never shows text that isn't in the data.
- `DiffView` uses `diffLines`, pairs removed/added runs into split rows, and
  folds unchanged runs > 8 lines.
- The zip is built client-side with `fflate` from `files + patches` via the
  browser-safe `applyPatches()` and `renderNecropsy()`.
- Visual language: see steering `lab-ui.md`.
