# Architecture

Field Route IQ is a small single-page React application. Its code is organized into three layers with clear responsibilities.

## Layers

### Data layer — [`src/data/`](../src/data/)

Provides typed loaders over the JSON fixture files (accounts, products, promotions, routes, visits). The public interface is [`src/data/index.ts`](../src/data/index.ts):

- `getProducts()`, `getAccounts()`, `getPromotions()`, `getRoutes()`, `getVisits()` — collection accessors.
- `getProduct(id)`, `getAccount(id)` — lookups by identifier.

All other modules must consume data through these loaders rather than importing JSON files directly. The loader boundary keeps fixture shape private to the data layer and makes it possible to swap the fixtures for a live data source later without touching consumers.

### Business-logic layer — [`src/pricing/`](../src/pricing/), [`src/audit/`](../src/audit/), [`src/settlement/`](../src/settlement/)

Pure TypeScript modules that implement the rules described in [`SPEC.md`](../SPEC.md). These modules:

- Have no dependency on React and perform no I/O.
- Export named functions whose signatures correspond to sections of `SPEC.md`.
- Are self-contained; the only cross-module dependency is that `settlement` imports the order pricer from `pricing`, because a route's totals are the sum of its priced orders.

Per-module engineering briefs are maintained under [`harness/`](../harness/) — they
are used by the AI-agent rig (see [`AGENTS.md`](../AGENTS.md)) and inline the rules
from `SPEC.md` for the three business modules.

New business-logic modules should follow the same shape: a folder under `src/`, one or more pure functions, and named exports.

### UI layer — [`src/pages/`](../src/pages/), [`src/state/`](../src/state/), [`src/App.tsx`](../src/App.tsx), [`src/main.tsx`](../src/main.tsx)

React components, page-level layouts, and local UI state. The UI wires business-logic outputs into user-facing views but does not implement business rules itself. When adding a feature that has both business logic and UI, implement the logic in the appropriate `src/<module>/` folder first and consume it from the UI.

## Legacy code

[`src/legacy/`](../src/legacy/) holds earlier iterations of the pricing engine and a proposed-but-abandoned discount-matrix design. It is retained for historical reference. New code should not import from it, and [`SPEC.md`](../SPEC.md) supersedes any behavior described inside it.

## Documents

- [`SPEC.md`](../SPEC.md) — normative business-logic specification (authoritative).
- [`docs/CONTRIBUTING.md`](CONTRIBUTING.md) — development workflow and feature-addition checklist.
- [`docs/NOTES.md`](NOTES.md) — early design meeting notes retained for context; `SPEC.md` supersedes it where they disagree.
