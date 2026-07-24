# Run scope

**This run: build all three modules.**

- [ ] Part A — `src/pricing/engine.ts` (`priceOrder`)
- [ ] Part B — `src/audit/shelfAudit.ts` (`auditAccounts`)
- [ ] Part C — `src/settlement/settle.ts` (`settleRoute`, reuses `priceOrder`)

Implement in the order above. Part C imports from Part A, so Part A must exist
before Part C compiles.

## How to stage a follow-up run (if this one falls short)

If a cheaper model can't carry all three at once, edit this file between
runs to name only the missing module(s), e.g.:

> **This run: settlement only. Pricing and audit are already implemented —
> see `harness/progress-notes.md`. Do not touch existing files.**

Then delete the checkboxes for parts that are done.
