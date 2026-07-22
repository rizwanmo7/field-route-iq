# AGENTS.md

This repository follows the [AGENTS.md](https://agents.md) convention for AI coding agents.

## Getting oriented

Read these documents in order when starting work in this repository:

1. [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — project overview, tech stack, repository layout, and code conventions.
2. [`SPEC.md`](SPEC.md) — the canonical behavioral specification for business logic. Treat it as the source of truth.
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layered architecture and module responsibilities.
4. [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — development workflow, how to add a feature, and the verification checklist.
5. [`docs/modules/`](docs/modules/) — per-module engineering briefs. Skim the brief for the module you are implementing before reading its `SPEC.md` section.

## Verification checklist

Before finishing a change, run:

- `npx tsc -p tsconfig.app.json --noEmit` — TypeScript type-check
- `npm run build` — production build
- `npm test` — existing test suite

## Scope discipline

- Modify only the files necessary for the change you are making.
- Do not add runtime dependencies, reconfigure the build, or introduce new tooling without discussion.
- Do not write new tests unless the task explicitly calls for them; the existing test suite is intentionally minimal.
- Do not modify `src/legacy/` — it is deprecated code kept only for historical reference.
