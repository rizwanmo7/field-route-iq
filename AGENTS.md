# AGENTS.md

Entry point for AI coding agents working in this repository.

## Compliance with `RULES.md`

This harness is designed to comply with the challenge rules:

- **`SPEC.md` is the source of truth.** The `harness/brief-*.md` files are
  distilled *from* `SPEC.md` (§2–§7 for pricing, §10 for audit, §11 for
  settlement) — the strategy of distilling briefs is what Rule §"Strategy
  hints" explicitly encourages. If a brief is silent or ambiguous, open
  the matching `SPEC.md` section.
- **No test-suite fishing.** The briefs and instructions are derived only
  from `SPEC.md`; no hidden-test knowledge is encoded.
- **The agent must not write or run tests** and must not score itself.
  See the "Do not run" section in `.github/copilot-instructions.md`.
- **Cumulative cost tracked in `COST.txt`** by `agent-run.mjs`. Do not
  hand-edit it.
- **Frozen files:** the agent may not modify `src/data/*.json`,
  `src/legacy/**`, `docs/**`, `SPEC.md`, `RULES.md`, `AGENTS.md`, this
  harness, or any config. Write scope is limited to `src/pricing/`,
  `src/audit/`, `src/settlement/`.

## Read first

1. `.github/copilot-instructions.md` — the rig: read path, wrong-files table, global rules.
2. `harness/run-scope.md` — which module(s) to build this run.
3. `harness/progress-notes.md` — what's already done.
4. The brief for the module(s) in scope: `harness/brief-{pricing,audit,settlement}.md`.
5. `src/data/index.ts` — loader signatures.

`SPEC.md` is the canonical authority; consult a specific section only when
the matching brief does not cover your case. Do **not** open
`src/legacy/**` or `docs/NOTES.md` — see the wrong-files table in
`.github/copilot-instructions.md` for the specific rules each one gets
wrong.

## Deliverables

- `src/pricing/engine.ts` — `priceOrder(input): PricedOrder`
- `src/audit/shelfAudit.ts` — `auditAccounts(asOf): AccountAudit[]`
- `src/settlement/settle.ts` — `settleRoute(input): RouteSettlement`
  (imports and reuses `priceOrder` from `../pricing/engine`)

## Between runs

The user steers by editing `harness/run-scope.md` (what to build next) and
`harness/progress-notes.md` (what's done). The agent may append to
`progress-notes.md` on completion; nothing else outside `src/pricing/`,
`src/audit/`, `src/settlement/` may be modified.
