---
inclusion: always
---

# Product: RepoNecromancer

RepoNecromancer raises abandoned JavaScript/Node.js repositories from the dead
and **proves** they live. Kiroween 2026 — Resurrection track.

## Promise to the user

1. Point it at a dead repo (GitHub URL or a bundled specimen).
2. It explains *what killed it* (dependencies, config fossils, removed APIs).
3. It produces a modern tree that installs and runs on Node 20/22.
4. It generates regression tests and runs them against **both** the corpse and
   the resurrected tree, so the difference is evidence, not marketing.

## Principles

- **Evidence over vibes.** Every number in the UI comes from a real run
  (`npm run necro:verify`) or a live registry lookup. Never fake a green tick.
- **Deterministic first.** Codemods are AST transforms with explicit rules; no
  LLM rewrites inside the engine. An unsafe or ambiguous call site is flagged
  for a human (`fixed: false`) instead of guessed.
- **Preserve behaviour.** A codemod that changes semantics is a bug — the
  generated characterization tests exist to catch exactly that.
- **Small, sharp scope.** We support the JavaScript ecosystem of 2010–2016
  well (Express 3, Node 0.x core APIs, jQuery 1.x, Bower/Grunt/Travis) rather
  than every language badly.

## Vocabulary (use it in UI copy and docs)

| Term | Meaning |
|---|---|
| specimen | a bundled legacy repo in `presets/` |
| exhume | fetch + read a repo |
| graveyard | knowledge base of dead/deprecated packages (`engine/knowledge.ts`) |
| transplant | dependency audit + package.json rewrite |
| suture | an applied codemod |
| galvanize | regression test generation |
| pulse | health score 0–100 derived from findings |
| necropsy | the full report (`NECROPSY.md`) |
