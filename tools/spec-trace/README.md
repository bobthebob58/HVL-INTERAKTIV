# tools/spec-trace

## Purpose

Builds `docs/TRACEABILITY.md`: for each requirement in `docs/specs/` and the Documentation Standard, the
code that names it (a `Spec:` header line or an `@spec` tag) and the tests whose titles carry it in
brackets (`[SEC-001] …`). In check mode it also fails on duplicate IDs, references to IDs no spec
defines, a stale matrix, and MUST requirements of finished sessions that have no test (`DOC-004`).

"Tested" is mechanical: a running test title carries the ID. The tool does not judge what that test proves. For
`UD-031` and `NFR-003` the test is a check that the manual-testing documents agree
(`apps/server/a11y/accessibilityDocs.a11y.test.ts`); the manual results themselves are HVL's to record (D-079), as
the Evaluator Guide (§2) explains.

## How to run

```bash
npm run spec:trace                                          # regenerate docs/TRACEABILITY.md
npm run spec:trace -- --check                               # CI: fail on problems or a stale matrix
npm run spec:trace -- --check --done-through=S1             # also require a test for every S1 MUST
SPEC_TRACE_ROOT=/some/tree node tools/spec-trace/specTrace.mjs   # run against another tree (tests)
npx vitest run tools/spec-trace                             # the tests
```

It uses only Node built-ins, so it runs before `npm install`.
