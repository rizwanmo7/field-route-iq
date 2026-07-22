# GitHub Copilot instructions

Repository-wide guidance for GitHub Copilot and other AI coding assistants working in this codebase.

## About this project

Field Route IQ is a route-sales support tool used by field sales representatives to plan routes, place customer orders, audit shelves at store visits, and settle routes at end-of-day. It is a small single-page React + TypeScript application backed by a JSON fixture set for accounts, products, promotions, routes, and visits.

The canonical behavioral specification for business logic is [`SPEC.md`](../SPEC.md). Treat it as the source of truth when its rules conflict with anything else in the repository (comments, legacy code, or historical design notes).

## Tech stack

- TypeScript with strict mode (`verbatimModuleSyntax` and `noUnusedLocals` are enabled).
- React 18 + Vite for the UI shell.
- Vitest for the (minimal) test scaffolding.
- No runtime dependencies beyond React and its ecosystem.

## Repository layout

- [`src/data/`](../src/data/) — typed data loaders and JSON fixtures. All read access flows through the loaders exported by [`src/data/index.ts`](../src/data/index.ts).
- [`src/pricing/`](../src/pricing/) — order-pricing business logic.
- [`src/audit/`](../src/audit/) — shelf-audit computations.
- [`src/settlement/`](../src/settlement/) — end-of-day route settlement (depends on `pricing`).
- [`src/pages/`](../src/pages/), [`src/state/`](../src/state/), [`src/App.tsx`](../src/App.tsx) — UI shell; business rules do not belong here.
- [`src/legacy/`](../src/legacy/) — deprecated implementations retained for historical reference. Do not import from it in new code; `SPEC.md` supersedes any behavior encoded in these files.
- [`docs/`](../docs/) — architecture documentation, contributing guide, and historical design notes.

## Working conventions

- Read [`SPEC.md`](../SPEC.md) when implementing or modifying business logic. It is the authoritative behavioral contract; reason from the spec, don't guess.
- Use the loaders in [`src/data/index.ts`](../src/data/index.ts) for all data access. Do not import JSON files directly or add `fetch` calls for bundled data.
- Business-logic modules under `src/pricing/`, `src/audit/`, and `src/settlement/` are pure and side-effect-free. React and I/O belong in the UI layer.
- Use `import type { ... }` for type-only imports (required by `verbatimModuleSyntax`).
- Prune unused imports and locals (`noUnusedLocals` is enabled — unused symbols are a compile error).
- Prefer named exports over default exports.
- Match existing formatting; do not add or reconfigure formatters/linters.

## Verifying your work

Run these locally before committing:

- Type-check: `npx tsc -p tsconfig.app.json --noEmit`
- Production build: `npm run build`
- Existing tests: `npm test`

## Further reading

- [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — layered architecture and module responsibilities.
- [`docs/CONTRIBUTING.md`](../docs/CONTRIBUTING.md) — development workflow and feature-addition checklist.
- [`docs/modules/`](../docs/modules/) — per-module engineering briefs (interface, dependencies, and cross-references into `SPEC.md`).
