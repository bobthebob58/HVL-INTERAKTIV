# Design note: the research export (Q25)

| | |
|---|---|
| **Status** | Designed, not built, and not to be built before the precondition below |
| **The design** | [docs/privacy/research-export.md](../privacy/research-export.md): tiers A–C, the export order, the rules the exporter enforces, the package format, how it would be built and tested, an example notebook in Python and R |
| **Origin** | The owner's idea of 2026-10-26 (PROGRESS, S6 step 5): researchers at ALU and Pedagogisk akademi analyse learning data beside the system, while everything inside the product stays TypeScript |
| **Requirements** | None yet: no spec ID covers it. Related: `INS-006`, `DATA-002`, `DATA-003`, `DATA-005`, `DATA-010`, `DATA-012` |

## The precondition: nothing before the DPO and the owner decide

Research is a purpose of its own, outside teaching. It needs its own legal basis and the approval of HVL's data
protection officer before anything is built (Q6, Q25), and each export order needs the DPO's approval. Giving a
researcher the database's `hvli_analytics` role counts as research use too. Until the DPO has answered, this item is a
reading exercise, not a coding task.

## Your part, once it is approved

1. **A requirement and a decision first.** The owner adds a requirement to spec 05 and a decision to
   `docs/DECISIONS.md` that fixes which tiers are built (the design recommends tiers A and B first, which hold only
   *k*-suppressed aggregates; tier C, pseudonymous rows, only for a question A and B cannot answer).
2. **Build the exporter in TypeScript,** in `apps/server/src/research/` beside the insight and purge code it reuses
   (`src/insight/`, `src/privacy/purge/`), as §7 of the design describes: an operations command, never a web route; the same
   suppression core as insight, so a package can never show what the **Innsikt** tab hides; re-keyed pseudonyms for
   tier C, never the system's own `learnerKey`.
3. **Tests in the repository's manner:** unit tests per rule, fast-check property tests that no suppressed count can be
   recovered across files of one package, an integration test that builds a package from a fixture database and checks
   it against its schema, and a test that an order without an approval reference is refused.
4. **The example notebook** in Python or R (§8 of the design) reads only a package, never the database, and is
   reviewed by a researcher.

## Good review questions even before it is built

- Could two packages for overlapping questions be combined to recover a suppressed count (differencing, as D-106
  guards against in insight)?
- Does the design's tier B really carry no more risk than the **Innsikt** tab, which teachers already see?
- What would the DPIA input (`docs/privacy/DPIA-INPUT.md`) need to say about it?
