# tools/doc-lint

## Purpose

Checks the [Documentation Standard](../../docs/DOCUMENTATION-STANDARD.md) by machine, so documentation
cannot drift between reviews. Each rule is one small file in `checks/`, named after what it checks and
tagged with the requirement it enforces.

| Check (`--only=`) | Requirement | What fails |
|---|---|---|
| `module-header` | DOC-001 | a source file without a summary, `Why:`, `Spec:` (known IDs) and `Tests:`; tests need only summary and `Spec:` |
| `export-docs` | DOC-002 | an exported TypeScript symbol without a TSDoc comment, or an `@spec` tag naming an unknown ID |
| `rationale-tags` | DOC-003 | a `WHY:`/`SECURITY:`/… tag with under 15 characters, `UPSTREAM:` without a link, `SPEC-DEVIATION:` without `D-xxx` |
| `package-readme` | DOC-005 | an app or package README without its six sections, or a tool README without Purpose and How to run |
| `test-readability` | DOC-006 | a test file without an `[ID]` title, or a fixture folder without a README |
| `file-size` | DOC-007 | a source or `.prisma` file over 200 lines |
| `env-documented` | DOC-008 | a variable in `apps/*/src/config/env.ts` that `.env.example` does not explain, or the reverse |
| `locale-parity` | DOC-009 | `nn.json`, `nb.json` and `en.json` in a `locales/` folder with different keys |
| `deviations` | DOC-010 | a `SPEC-DEVIATION:` naming a decision that `docs/DECISIONS.md` does not have |
| `leftovers` | DOC-013 | a `TODO:` without `(S4)`, `(UD-012)` or a URL; commented-out code |
| `content-guides` | DOC-014 | a folder in `content/` without a README |

`checkCommitMessage.mjs` (DOC-011) runs from the `commit-msg` hook: Conventional Commit header, and a
`Refs:` footer with known IDs on `feat` and `fix` commits.

Fetched third-party files (`apps/server/h5p/`), `vendor/`, `generated/`, migrations and test fixtures
are not checked.

## How to run

```bash
npm run doc:lint                                   # every check; exit code 1 on any problem
node tools/doc-lint/docLint.mjs --only=file-size   # one check (npm run check:filesize)
node tools/doc-lint/docLint.mjs --root=/some/tree  # lint another tree
npx vitest run tools/doc-lint                      # the tests, with good and bad example trees
```

Output lines look like `✗ apps/server/src/x.ts:12 [DOC-002 export-docs] exported function "y" has no TSDoc comment`.

## Folder structure

| Path | Responsibility |
|---|---|
| `docLint.mjs` | Runs the checks and prints problems |
| `checks/*.mjs` | One rule each; every module exports `id`, `name` and `run(ctx)` |
| `lib/repo.mjs` | Which files count as source, and which requirement IDs exist |
| `checkCommitMessage.mjs` | Commit-message rule for the `commit-msg` hook |
| `test/tempRepo.mjs` | Builds the small example trees the tests lint |
| `test/ciWorkflow.test.mjs` | Checks that CI runs every gate of `NFR-004` |
