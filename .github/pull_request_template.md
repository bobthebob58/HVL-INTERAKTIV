## What and why

<!-- One or two sentences. Which user problem or requirement does this address? -->

Refs: <!-- requirement IDs, e.g. SEC-001, H5P-006 -->

## How it was verified

<!-- Commands run and their result; screenshots for UI; screen-reader notes for UI changes. -->

- [ ] `npm run typecheck && npm run lint && npm test`
- [ ] `npm run spec:trace -- --check` (TRACEABILITY.md regenerated)
- [ ] `npm run test:a11y` (UI changes)

## Documentation checklist (docs/DOCUMENTATION-STANDARD.md)

- [ ] Every new or changed source file has a correct module header (DOC-001)
- [ ] New exports have TSDoc; `@spec` IDs exist (DOC-002, DOC-004)
- [ ] Security, privacy, accessibility and pedagogy choices are tagged and explained (DOC-003)
- [ ] Tests are named with requirement IDs and readable on their own (DOC-006)
- [ ] Any deviation from a spec is in docs/DECISIONS.md and marked `SPEC-DEVIATION:` in code (DOC-010)
- [ ] UI strings exist in nn, nb and en (DOC-009)
- [ ] PROGRESS.md updated if a session checklist item is done
