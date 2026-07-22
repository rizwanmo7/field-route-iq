# Contributing

This guide describes how to add or modify features in Field Route IQ. It applies to both human contributors and AI coding agents.

## Prerequisites

- Node.js and npm.
- Familiarity with TypeScript and React.

## Setup

```bash
npm install
```

## Development workflow

### Adding a business-logic feature

1. **Read the specification.** Locate the relevant section of [`SPEC.md`](../SPEC.md) and read it fully. If the feature is genuinely new, `SPEC.md` should describe it first (updating `SPEC.md` is a legitimate change on its own).
2. **Locate or create the module.** Business-logic modules live under `src/`. Reuse an existing module (`pricing`, `audit`, `settlement`) when the feature fits its scope; otherwise create a new folder with a single clearly-named responsibility. Follow the layering rules in [`ARCHITECTURE.md`](ARCHITECTURE.md).
3. **Implement.** Write pure, typed functions. Consume data via the loaders in [`src/data/index.ts`](../src/data/index.ts). Match the existing code style.
4. **Verify.** Run the checks under **Verification** below.
5. **Wire the UI** if the feature has a user-facing surface. UI wiring lives in `src/pages/` and `src/App.tsx`; the business module should not know that a UI exists.

### Modifying existing behavior

Locate the module under `src/`, consult the corresponding `SPEC.md` section, apply your change, and run the verification checks. If your change alters observable business behavior, update `SPEC.md` as part of the same commit.

### Adding data

Extend the JSON fixture in `src/data/` and expose its shape through the loader in `src/data/index.ts`. Consumers should not import JSON files directly.

## Verification

Run all three before committing:

- `npx tsc -p tsconfig.app.json --noEmit` — TypeScript type-check
- `npm run build` — production build
- `npm test` — existing test suite

## Coding standards

- TypeScript strict mode is enabled.
- `verbatimModuleSyntax` requires `import type { ... }` for type-only imports.
- `noUnusedLocals` requires removing unused imports, parameters, and local variables.
- Prefer named exports over default exports.
- Business logic is pure and side-effect-free; keep React and I/O in the UI layer.
- Do not add runtime dependencies or reconfigure the build without discussion.

## TypeScript patterns used in this codebase

Two typed patterns from [`src/data/index.ts`](../src/data/index.ts) are common enough
to be worth calling out explicitly:

**Discriminated unions.** The `Promotion` type is a union of `PercentOffPromotion`,
`BogoPromotion`, and `ThresholdPromotion`. Each variant carries different fields
(e.g. `category`/`minSubtotal`/`amountOff` exist only on `ThresholdPromotion`).
Narrow on the `type` discriminant before accessing variant-specific properties:

```ts
if (promo.type === 'threshold') {
  // promo.category, promo.minSubtotal, promo.amountOff are accessible here
}
```

**Optional lookup returns.** `getProduct(id)` and `getAccount(id)` return
`T | undefined` — the id may not exist. Handle the absent case explicitly (typically
by throwing per the spec's error rules in [`SPEC.md`](../SPEC.md) §7).

**Type-only imports.** With `verbatimModuleSyntax` enabled, any import used only in
a type position must use the `import type` form:

```ts
import type { PriceOrderInput, PricedOrder } from '../pricing/engine'
```

A regular value-import of a type-only symbol is a compile error.

## Documentation

- Update [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) if your change alters a module boundary or introduces a new layer.
- Update [`SPEC.md`](../SPEC.md) if your change alters user-facing business behavior.
- Keep this file (`CONTRIBUTING.md`) up to date if the workflow itself changes.
