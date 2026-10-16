# Documentation Standard

| | |
|---|---|
| **Status** | Mandatory from Session 1 (v1.0, 2026-10-16) |
| **Owns requirement IDs** | `DOC-*` |
| **Applies to** | Every file in `apps/`, `packages/`, `tools/` and `content/` |

## Why this standard exists

HVL Interaktiv will be reviewed by people who did not write it: ALU learning designers, TeCopp
administrators, security and privacy reviewers, and external evaluators. Most will not know H5P,
LTI or Norwegian higher-education terms. They should be able to open **any** file and answer
these five questions within a minute:

1. **What** does this file do?
2. **Why** does it exist? Which requirement in `docs/specs/` does it fulfil?
3. **What must never go wrong** here? (invariants, security or privacy assumptions)
4. **How do I know it works?** Which tests prove it?
5. **What does it connect to?** (callers and collaborators)

The rules below make those answers appear in predictable places. Wherever possible a tool checks
them, so the documentation cannot quietly rot.

---

## The documentation layers

| Layer | Where | Answers | Rule |
|---|---|---|---|
| 1. Repository orientation | `README.md`, `docs/GLOSSARY.md`, `docs/DECISIONS.md`, `PROGRESS.md`, `docs/EVALUATOR-GUIDE.md` | What is this project, what state is it in, what was decided and why? | — |
| 2. Specifications | `docs/specs/*.md` | What must the system do, and how will we know? | Requirement IDs |
| 3. Package READMEs | `apps/*/README.md`, `packages/*/README.md` | How is this package structured, and how do its main flows work? | `DOC-005` |
| 4. Module headers | Top of every source file | What / why / spec / invariants / tests / collaborators | `DOC-001` |
| 5. API docs (TSDoc) | Every exported symbol | How to call it correctly | `DOC-002` |
| 6. Rationale comments | Inline, tagged | Why this non-obvious line is the way it is | `DOC-003` |
| 7. Tests | `*.test.ts`, `e2e/*.spec.ts` | Executable proof, named by requirement | `DOC-006` |
| 8. Traceability | `docs/TRACEABILITY.md` (generated) | Requirement → code → test, at a glance | `DOC-004` |

---

## Rules

#### DOC-001 · MUST · S1 · Every source file starts with a module header
Use exactly these labels. Omit a label only when it truly does not apply, never "TODO".

```ts
/**
 * SvgSanitizer — removes executable content from SVG files that authors upload.
 *
 * Why: @lumieducation/h5p-server up to and including 10.0.4 is affected by
 *      CVE-2025-7062 (stored XSS through uploaded files) and no fixed release
 *      exists, so HVL Interaktiv sanitises every SVG itself (decision D-003).
 * Spec: SEC-001
 * Invariants:
 *   - Output never contains <script>, on* attributes, <foreignObject>,
 *     <!DOCTYPE> or <!ENTITY>.
 *   - Never throws on malformed input; returns NotSanitized and the file is rejected.
 * Collaborators: registered in H5pEditorFactory via `fileSanitizers`.
 * Tests: apps/server/test/security/SvgSanitizer.test.ts
 */
```

*Checked by:* `tools/doc-lint` (added in Session 1). It fails if a file under `apps/`, `packages/`
or `tools/` lacks a header, or if a `Spec:` ID does not exist in `docs/specs/`. React components
and CSS files use the same header in their language's comment syntax.

#### DOC-002 · MUST · S1 · Every exported symbol has TSDoc
Each exported function, class, method, type and constant has a one-sentence summary. Add
`@param` and `@returns` where they add meaning beyond the type. Use `@throws` for every error a
caller must handle. Add an `@example` for anything with more than two parameters or a non-obvious
call order. Add `@spec <ID>` when the symbol directly implements a requirement.

```ts
/**
 * Derives the pseudonymous key under which a learner's data is stored.
 *
 * The same person gets different keys in different academic years, and
 * different keys in Feide and Canvas modes, by design (DATA-002).
 *
 * @param source - `feide|<feide-id>` or `lti|<iss>|<sub>`; never persisted.
 * @param academicYear - e.g. `2026` for the year starting 1 August 2026.
 * @returns 64-character lowercase hex HMAC-SHA256.
 * @throws {MissingPseudonymSecretError} if the year's secret has been destroyed by the purge.
 * @spec DATA-002
 */
export function deriveLearnerKey(source: string, academicYear: number): string { … }
```

*Checked by:* `eslint-plugin-jsdoc` (`require-jsdoc` for exports, `require-param`,
`check-tag-names` with `spec` registered in `tsdoc.json`). TypeDoc builds browsable API docs in CI.

#### DOC-003 · MUST · S1 · Explain non-obvious code with tagged rationale comments
Comments explain **why**, never restate **what**. Use one of these tags so reviewers can grep for them:

| Tag | Use when | Must contain |
|---|---|---|
| `WHY:` | The obvious alternative is wrong for a reason | The reason |
| `SECURITY:` | The line defends against a threat | The threat **and** how this line mitigates it |
| `PRIVACY:` | The line limits personal data | Which data, and which `DATA-*` requirement |
| `A11Y:` | The line exists for accessibility | The WCAG criterion or user need |
| `PEDAGOGY:` | A threshold or default comes from learning research | The reference key from spec 04 §3 |
| `UPSTREAM:` | A workaround for a bug in H5P, Lumi, ltijs or Canvas | Link to the upstream issue, and when it can be removed |
| `SPEC-DEVIATION:` | The code knowingly differs from a spec | The decision ID in `DECISIONS.md` |

```ts
// SECURITY: the ltik grants access to a learner's launch for 24 h. Strip it from the URL
// immediately so it cannot leak through Referer headers, history or screenshots (LTI-003).
window.history.replaceState(null, '', withoutLtik(window.location.href));
```

*Checked by:* review (see the PR template). `grep -rn "SECURITY:" apps/` must give an evaluator a
complete tour of the security-relevant lines.

#### DOC-004 · MUST · S1 · Requirement IDs connect spec, code and tests
- Code: `Spec:` in the module header and/or `@spec` in TSDoc.
- Tests: the `describe` or `it` title starts with the ID in brackets: `it('[SEC-001] strips inline <script> elements', …)`.
- `node tools/spec-trace/specTrace.mjs` (wired as `npm run spec:trace` in Session 1) regenerates
  `docs/TRACEABILITY.md`. With `--check` it fails CI on: duplicate IDs, references to unknown IDs,
  and **MUST** requirements of completed sessions that have no test reference.

#### DOC-005 · MUST · S1 · Each app and package has a README
Sections, in order:
1. Purpose (2–3 sentences).
2. How to run it locally.
3. Folder structure, one line per folder.
4. Key flows as Mermaid sequence diagrams. Required: Feide login, LTI launch, Deep Linking,
   xAPI → AGS, pseudonymisation, library install.
5. Configuration (link to `.env.example`).
6. Which specs it implements.

#### DOC-006 · MUST · S1 · Tests are written to be read
- Name tests as behaviour, not implementation: `[H5P-006] denies library installation to authors`,
  not `test checkForGeneralAction 2`.
- Use *Arrange / Act / Assert* comments in tests longer than 10 lines.
- Every fixture directory has a `README.md` that says what each fixture represents and why it exists
  (e.g. `svg/xxe-external-entity.svg — standalone="no" with an external entity; must be neutralised`).
- Table-driven tests (`it.each`) are preferred for permission and role matrices, so the table in the
  test matches the table in the spec.

#### DOC-007 · MUST · S1 · Small, explicitly named files
Source files have **≤ 200 lines** and one responsibility. Names say what the file is
(`HvlTop10ContentTypeFilter.ts`, not `utils.ts`). PascalCase is used for files exporting a class or
component, and camelCase for files exporting functions.
*Checked by:* `npm run check:filesize`.

#### DOC-008 · MUST · S1 · Configuration is documented where it is defined
Every environment variable appears in `.env.example` with: a purpose comment, whether it is secret,
its default, and an example value. Startup validation (zod) fails with a message naming the
variable and pointing to `.env.example`.

#### DOC-009 · MUST · S1 · Language conventions
- Code, comments and developer docs are in **English**, so international reviewers and the
  open-source community can read them.
- Norwegian domain terms keep their Norwegian form in identifiers and enums (`forarbeid`,
  `laeringsutbytte`, `pedagogiskMappe`) and are explained in [GLOSSARY.md](GLOSSARY.md). Do not
  invent English translations that a teacher at HVL would not recognise.
- **No user-facing string is hard-coded.** UI text lives in `nn`/`nb`/`en` locale files.
  *Checked by:* `eslint-plugin-i18next` (`no-literal-string` in JSX) and the key-parity test (`PROD-012`).

#### DOC-010 · MUST · S1 · Decisions and deviations are logged
Record a decision in [DECISIONS.md](DECISIONS.md) whenever you: choose between real alternatives,
deviate from a spec, pin or accept a vulnerable dependency, or add or remove a content type. The
entry gives context, the decision, its consequences, and the date. Code affected by a deviation
carries `SPEC-DEVIATION: D-xxx`.

#### DOC-011 · MUST · S1 · Commit messages are traceable
Use Conventional Commits (`feat(h5p): …`, `fix(lti): …`, `docs(spec): …`). Add a `Refs:` footer
listing requirement IDs, for example `Refs: SEC-001, H5P-006`.

#### DOC-012 · SHOULD · S3 · HTTP APIs are self-describing
Request and response bodies are zod schemas. An OpenAPI document is generated from them and served
at `/api/docs` in development. Every route file states its authentication mode (portal, LTI,
either, or admin) and its error responses in the module header.

#### DOC-013 · MUST · S1 · No silent leftovers
- No commented-out code.
- No `TODO` without an owner and a reference: `TODO(S4, UD-012): …` or an issue URL.
- No comment that contradicts the code. If you change behaviour, update the header, the TSDoc and
  the spec in the same commit.

#### DOC-014 · MUST · S1 · Content that non-developers edit has its own guide
`content/**/README.md` explains, for ALU staff, how to edit patterns, guide text, phase labels and
portfolio templates. It includes an example and states which tests will catch mistakes.

---

## Reviewer checklist (also in `.github/pull_request_template.md`)

- [ ] Every new or changed file has a correct module header (`DOC-001`).
- [ ] New exports have TSDoc; `@spec` IDs exist (`DOC-002`, `DOC-004`).
- [ ] Security, privacy, accessibility and pedagogy decisions are tagged and explained (`DOC-003`).
- [ ] Tests are named with requirement IDs and readable on their own (`DOC-006`).
- [ ] `docs/TRACEABILITY.md` is regenerated and `--check` passes.
- [ ] Any deviation is in `DECISIONS.md` and marked in code (`DOC-010`).
- [ ] UI strings exist in `nn`, `nb` and `en` (`DOC-009`).
