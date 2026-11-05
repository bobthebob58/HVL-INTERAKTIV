# IT assurance pack: start here

| | |
|---|---|
| **For** | HVL IT: operations and security staff who decide whether HVL Interaktiv may be hosted, first for testing only |
| **Status** | **Draft for HVL IT to correct.** Lines marked *(IT to fill in)* are HVL facts the repository cannot know |
| **Written** | 2026-11-05, at the repository owner's request, by the same AI assistant (Claude) that wrote the code |
| **Reviewed by** | Nobody yet. No person has reviewed this pack, the code or its tests |

## Samandrag (nynorsk)

> Dette samandraget er ikkje gjennomgått av språkrådgjevarane ved HVL.

HVL Interaktiv er eit verktøy der lærarar ved HVL lagar korte, interaktive H5P-aktivitetar og legg dei inn i Canvas.
Ein KI-assistent (Claude) har skrive all koden og alle testane, og har sjølv gjort kodegjennomgangane. Ingen person
har gått gjennom koden enno. Denne pakken er til HVL IT, som skal vurdere om tenesta kan setjast opp, først berre til
testing. Vi ber om tre steg: Steg 0 er studentar som prøver verktøyet på eigne maskinar eller i Codespaces, mot ein
etterlikna Feide og ein etterlikna Canvas, og det treng ingenting frå IT. Steg 1 er ein isolert testserver med berre
oppdikta data, testbrukarar i Feide og testinstansen av Canvas, i ei avgrensa tid. Steg 2 er ein pilot med ekte
studentar i eitt eller to emne, men først når personvernombodet har godkjent, ein person har gjort ein
tryggleiksgjennomgang, og ROS-analysen og ein driftsavtale er på plass. Dokumenta her er utkast som IT skal rette.

## What HVL Interaktiv is

A tool for HVL teachers to build short, accessible H5P activities from research-based patterns, place them in Canvas
with LTI 1.3, and see anonymised insight before the next seminar ([root README](../../README.md)). It is one Node.js 24
server process (Express 5 with the Next.js web app inside it) that uses PostgreSQL 16, Redis 7 and S3-compatible
storage, logs in through Feide, and serves uploaded files from a second host name (CLAUDE.md §2; D-068; D-012;
D-110).
Learners are stored as keyed pseudonyms, with no names or e-mail addresses; the one exception is a learner's Canvas
ID, kept encrypted in a grade job until 30 days after the job stops (`DATA-002` and its D-104 amendment). Teachers see
aggregates with groups under five hidden (`INS-006`). It is open source (GPL-3.0-or-later, D-015) and still in
development: the last build session, S6, has not passed its gate yet (PROGRESS.md, S6 step 11).

## What we ask of IT, in stages

| Stage | What it is | What it needs from IT | What must be true first |
|---|---|---|---|
| **0** | Students and reviewers run the app on their own machines or in GitHub Codespaces, against the mock Feide and mock Canvas, with made-up users ([.devcontainer/README.md](../../.devcontainer/README.md); D-049) | Nothing | — |
| **1** | An **isolated test server**: made-up data only, Feide test users, HVL's test Canvas, named testers, time-limited | A host, two DNS names and certificates, PostgreSQL 16, Redis 7, S3-compatible storage in the EEA, a clamd, outbound access to Feide and the test Canvas: **[test-environment.md](test-environment.md)** | IT's go-ahead after reading this pack; a named system owner and a contact for the test install (Q31); Feide registration (Q3); TeCopp's test developer key (Q4, Q13); the hosting answers (Q5) |
| **2** | A **pilot** with real students in one or two courses | Production operation: every line of the deployment checklist ([runbook §9](../ops/runbook.md)), backups, monitoring, an operations agreement *(IT to fill in)* | The DPO's approval of the DPIA (Q6); a human security review ([human-review.md](human-review.md)); the ROS-analyse ([ros-analyse.md](ros-analyse.md)); an operations agreement and a named maintainer (Q31); ALU's review of the studio drafts (Q17); the manual accessibility run (`UD-031`); the 200-learner load test and a restore drill (runbook §8, §6) |

The Q numbers are the open questions in [PROGRESS.md](../../PROGRESS.md), «Open questions and blockers». The
stages are recorded in D-116; PROGRESS.md's «Blocks» column names a session or "the pilot" (stage 2) instead.

## Status in one table

| Area | Built | Verified how | Verified by |
|---|---|---|---|
| The ten H5P content types: author and play | Yes (S2, S4) | Unit, integration and Chromium tests, including the ten real types from pinned GitHub commits (`apps/server/test/h5p/realTypes.browser.int.test.ts`; D-078) | AI only |
| Feide login and portal sessions | Yes (S3) | Tests against a mock Feide (`tools/mock-platform`, D-049); never against real Feide | AI only |
| Canvas LTI 1.3: launch, Deep Linking, grades (AGS), roster (NRPS) | Yes (S3, S6), except the picker's content bank and "new from a pattern", the duplicate in `/app/play`, and Dynamic Registration (`LTI-009`, not built) ([hand-off §1, §3](../handoff/README.md)) | Tests against a mock Canvas; the live-contract seam (36 tests) has run against the mocks only (PROGRESS.md, S6 step 7) | AI only |
| Upload security against CVE-2025-7062 (unpatched upstream) | Yes (S2, S6); the editor's files are still on the app origin (`SPEC-DEVIATION: D-110`, `apps/server/src/http/createH5pRouter.ts:58`) | Unit tests with bypass payloads (`SvgSanitizer.bypass.test.ts`), integration tests, a local clamd 1.4.6, the Docker smoke test (D-003, D-110) | AI only |
| Teacher insight with *k*-suppression | Yes (S6) | Property-based tests (`insightSuppression.property.test.ts`) and a hand-calculated 30-learner fixture (`thirtyLearners.test.ts`) | AI only |
| Privacy operations: pseudonyms, yearly purge, data-subject requests, database roles, production start-up checks, log redaction | Yes (S1, S6) | Integration tests on local PostgreSQL and Redis ([docs/ops/](../ops/README.md)) | AI only; the DPO has not reviewed the DPIA input (Q6) |
| Accessibility, WCAG 2.2 AA | Yes (S4–S6) | axe and Playwright, Chromium only: 558 tests passed on 2026-11-05 (`docs/accessibility/automated-run.json`) | AI only; no manual results, so all 56 criteria are *Not yet determined* ([conformance report](../accessibility/WCAG-CONFORMANCE-REPORT.md)) |
| Docker image and app stack | Yes (S6) | Smoke test in the development sandbox ([docs/ops/docker.md](../ops/docker.md)); `.github/workflows/docker.yml` has never run on GitHub (PROGRESS.md, S6 step 6) | AI only |
| Load | Harness built (D-114) | 20-learner smoke on one 4-CPU machine passed; the 200-learner test has not run (runbook §8) | AI only |
| Backups and restore | Yes (S6) | Round trip on local services (`tools/ops/test/backupRoundTrip.test.mjs`); no restore drill on HVL hardware | AI only |
| Requirements overall | 123 of 126 have a test that names them; 3 are planned | "Tested" only means a test title carries the ID; it is not proof (docs/TRACEABILITY.md, lines 6–7) | AI only |
| Continuous integration | S1–S5 passed on GitHub in pull request #8 (run 41066236672) | The CI run on `main` after the merge failed in one end-to-end test (run 41075981429; PROGRESS.md, Q16); the fix is one of the 14 commits after `main` (the Codespaces dev container and S6), which have not run in GitHub CI, because CI runs only on `main` and on pull requests (`.github/workflows/ci.yml`, lines 9–12); S6's gate is running locally | AI only |

## The honest caveat

- **AI-written.** 213 of the repository's 214 commits are by Claude; the other is the merge of pull request #8, made
  on GitHub from the repository owner's account (`git log --format='%an'`). The owner made the product decisions,
  approved the plans of S2–S6 (PROGRESS.md), tried the app in a Codespace (commit `0943a73`) and looked at
  screenshots (PROGRESS.md, S4). That is using the app, not reviewing its code.
- **Tests and reviews by the same author.** The AI wrote the code, the tests and every review round, and checked its
  own tests by changing the code on purpose (mutation checks). Where PROGRESS.md and `docs/privacy/DPIA-INPUT.md` §10
  say "independent review", they mean separate AI agent passes, not people.
- **No human review yet.** No code review by a person is recorded. Pull request #8 was merged with no review on
  GitHub (0 reviews, read through GitHub's API on 2026-11-05), and the planned "an HVL developer reads a sample" has
  not happened (PROGRESS.md, S6 step 10).
- **Why a human review comes next.** One author's code, tests and reviews can share blind spots. The record shows it:
  full test runs keep finding faults the AI reviews missed, for example the grade worker claiming three jobs with a
  limit of one (PROGRESS.md, S6 step 3) and three faults under load at the S5 gate (session log, 2026-10-30). A person
  reading the riskiest modules first is the cheapest way to find what the method cannot. Where to start:
  [human-review.md](human-review.md).
- **Mocks, not HVL's services.** Canvas and Feide have been tested against mocks only ([root README](../../README.md),
  status; [hand-off §3](../handoff/README.md)); stage 1 is the first contact with the real ones.

## Who is accountable

| Role | Who |
|---|---|
| System owner (*systemeigar*) at HVL | **Not named.** *(IT to fill in.)* Open question Q31 in PROGRESS.md (D-116): needed before stage 1 |
| Maintainer (*forvaltar*) at HVL: patches, image rebuilds, the yearly key and purge steps | **Not named.** *(IT to fill in)*; Q31: needed before stage 2 at the latest, since the runbook's steps need one ([docs/ops/runbook.md](../ops/runbook.md) §4–§7) |
| Product decisions, until the above are named | The repository owner (PROGRESS.md, for example «Decided while planning S6 (owner, 2026-10-30)») |
| Data protection | HVL's data protection officer reviews the DPIA input (Q6) |
| Canvas | TeCopp, HVL's Canvas team (docs/GLOSSARY.md): the developer key and test courses (Q4, Q13) |
| Security reports | Private reporting per [SECURITY.md](../../SECURITY.md); HVL's e-mail address there is still a placeholder |

**HVL's bachelor students in programming (spring 2027).** Their project is to review this AI-written code with their
own tools and to finish the Canvas integration against ALU's Canvas test instance (D-101;
[hand-off index](../handoff/README.md)). That review is welcome evidence, but it has a limit: it is a one-term student
project. It does not replace a named system owner and maintainer, HVL IT's own security review or the DPO's review,
and the hand-off index says the tasks that need a person or system at HVL "are not student tasks" (§2).

## The pack's documents

| Document | What it holds |
|---|---|
| [README.md](README.md) | This overview: stages, status, caveat, accountability |
| [architecture.md](architecture.md) | Components, trust boundaries, network flows, data stores, secrets and deployment |
| [threat-model.md](threat-model.md) | A STRIDE threat model draft: threats, mitigations with evidence, residual risks |
| [ros-analyse.md](ros-analyse.md) | A draft ROS-analyse (risk and vulnerability analysis) for IT to correct |
| [human-review.md](human-review.md) | What has and has not been reviewed, by whom, and what people should review first |
| [test-environment.md](test-environment.md) | The stage-1 request: an isolated test install with made-up data only |
| [sbom.cdx.json](sbom.cdx.json) | A CycloneDX software bill of materials, made by `npm run sbom` ([tools/sbom/](../../tools/sbom/README.md)) |

## Where the evidence is

| Evidence | Where |
|---|---|
| Why each choice was made (D-001…D-116, with dated amendments) | [docs/DECISIONS.md](../DECISIONS.md) |
| Requirement → code → test (generated) | [docs/TRACEABILITY.md](../TRACEABILITY.md) |
| How to check the code against the specs, and its known limitations | [docs/EVALUATOR-GUIDE.md](../EVALUATOR-GUIDE.md) (§2, §6) |
| Personal data, legal basis, residual risks R1–R40, the DPO's questions | [docs/privacy/DPIA-INPUT.md](../privacy/DPIA-INPUT.md) |
| Every stored field, Redis key and log field | [docs/privacy/DATA-INVENTORY.md](../privacy/DATA-INVENTORY.md) |
| Operations: what IT provides, secrets, backups, monitoring, the deployment checklist | [docs/ops/runbook.md](../ops/runbook.md) and [docs/ops/](../ops/README.md) |
| Accessibility conformance (automated results; manual pending) | [docs/accessibility/WCAG-CONFORMANCE-REPORT.md](../accessibility/WCAG-CONFORMANCE-REPORT.md) |
| What is done, what needs HVL, what passes to the students | [docs/handoff/README.md](../handoff/README.md) |
| Build progress, open questions Q1–Q31 (there is no Q11), every gate's output | [PROGRESS.md](../../PROGRESS.md) |
