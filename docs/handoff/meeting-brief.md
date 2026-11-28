# Brief for a first meeting: a test Canvas and a real backend

| | |
|---|---|
| **For** | An HVL developer and the person responsible for Canvas at HVL (TeCopp), before a first meeting with the repository owner |
| **Written** | 2026-11-26, at the repository owner's request, by the same AI assistant (Claude) that wrote the code. Reviewed by nobody yet |
| **What it is** | A short way in. It asks for nothing new: every statement comes from the document it links to, and where the two differ, that document is right |
| **Keep up to date** | [PROGRESS.md](../../PROGRESS.md) is the build's single source of truth; this brief describes 2026-11-26 |

## Samandrag på nynorsk

> Dette samandraget er ikkje gjennomgått av språkrådgjevarane ved HVL.

HVL Interaktiv er eit verktøy der lærarar ved HVL lagar korte, interaktive H5P-aktivitetar og legg dei inn i Canvas.
Ein KI-assistent (Claude) har skrive all koden og alle testane, og ingen person har gått gjennom koden enno. Canvas og
Feide er berre prøvde mot ein etterlikna Canvas og ein etterlikna Feide. Dette notatet er til ein utviklar ved HVL og
til den som har ansvar for Canvas, før eit første møte. Det seier kvar arbeidet står i dag (del 2), kva vi ber
utviklaren om (del 3), kva vi ber Canvas-ansvarleg om (del 4), kva ein testserver treng (del 5), kva møtet bør avgjere
(del 6) og kva vi ikkje ber om no (del 7). Alt gjeld ein test med berre oppdikta data og testbrukarar. Ekte studentar
kjem først når personvernombodet har godkjent og ein person har gjort ein tryggleiksgjennomgang. Resten av notatet er
på engelsk, som utviklardokumentasjonen elles.

## 1. What it is

A tool for HVL teachers to build short, accessible H5P activities from research-based patterns, place them in Canvas
with LTI 1.3, and see anonymised insight before the next seminar ([root README](../../README.md)). It is one Node.js 24
server process (Express 5 with the Next.js web app inside it) that uses PostgreSQL 16, Redis 7 and S3-compatible
storage, logs in through Feide, and serves uploaded files from a second host name. Learners are stored as keyed
pseudonyms; teachers see aggregates, with groups under five hidden. It is open source (GPL-3.0-or-later). The longer
description is in [docs/assurance/README.md](../assurance/README.md), «What HVL Interaktiv is».

Three things to know before anything else ([docs/assurance/README.md](../assurance/README.md), «The honest caveat»):

- **An AI wrote it.** The code, the tests and every review round are by Claude. No person has reviewed the code
  ([human-review.md](../assurance/human-review.md) §1).
- **Canvas and Feide are tested against mocks only** (`tools/mock-platform`). A test install is the first contact with
  the real ones.
- **Made-up data only**, so far and in a first test (`DATA-010`).

## 2. Where it stands on 2026-11-26

| | |
|---|---|
| **Built** | Six build sessions, S1 to S6, each closed by a gate whose output is in PROGRESS.md. What each built: [hand-off index](README.md) §1 |
| **After S6** | Security repairs in 31 steps (2026-11-20 to 2026-11-26). Each has tests, a gate run and a decision entry, D-117 to D-147 in [docs/DECISIONS.md](../DECISIONS.md) (PROGRESS.md: the status row «SR» and the session log, steps 1–31) |
| **On `main`** | Steps 1–30, merged in pull request #25 on 2026-11-26. GitHub's two workflows passed on the pull request and on `main` after the merge (runs 45856531376 and 45856531373): «CI», which runs the session gate, and «Docker», which builds the image and smoke-tests the app stack. Step 31, a dependency update, followed in pull request #28 |
| **Tests** | The last full local run is in PROGRESS.md, step 31: 27,137 server tests passed, with the web, tools, accessibility and end-to-end suites beside them. Read that number with care: the server suite has about 3,000 written test cases, and three tables that try every combination of who may do what (`userDataMatrix`, `contentMatrix` and `duplicateRules`) make up about 22,000 of the count. Five test files cannot run in the development container (they need a privileged database or the PDF sandbox); GitHub's «CI» runs them. The same AI wrote every test, so treat each as a claim, not as proof |
| **Not built** | `LTI-009` and the Canvas side of the studio; `PROD-014` was built on 2026-11-27, D-152, and `INS-004` on 2026-11-28, D-154 ([hand-off index](README.md) §1, §3) |
| **Done by nobody yet** | A person's code review; a real Canvas and a real Feide; the manual accessibility test; the data protection officer's review; the load test and a restore drill on HVL's hardware ([docs/assurance/README.md](../assurance/README.md), «What people must review and test») |

The longer documents this brief points to were written on 2026-11-05 and 2026-11-06. The security repairs amended them
where a rule changed, but their figures (test counts, commit IDs, CI run numbers) are from those days.

## 3. For the developer

1. **Run it.** This needs nothing from HVL IT. Use GitHub Codespaces ([.devcontainer/README.md](../../.devcontainer/README.md):
   a machine with 4 cores, about 20–30 minutes for the first start, opened in VS Code on your own computer because
   the mocks need `localhost` ports), or your own machine with Node.js 24 and Docker («How to run» in
   [apps/server/README.md](../../apps/server/README.md)). The app then runs against the mock Feide and the mock
   Canvas, with made-up users.
2. **Read in this order:** the [root README](../../README.md); [CLAUDE.md](../../CLAUDE.md), the rules every change
   follows; [architecture.md](../assurance/architecture.md) and [threat-model.md](../assurance/threat-model.md); then
   the [hand-off index](README.md) §4, «Suggested review targets». It names the five modules where a defect costs
   most, each with why it is risky, what to try and which tests claim to prove it: *k*-suppression of insight, the
   grade worker, the files origin, the xAPI bridge and the LTI launch.
3. **Check, do not trust.** `npx vitest run -t "LTI-004"` runs the tests of one requirement, and
   `grep -rn "SECURITY:" apps/` is a tour of the security-relevant lines. Change a line and see whether a test fails.
   The full plan for reviewers, in order of risk and with a checklist per area, is
   [human-review.md](../assurance/human-review.md) §4.
4. **Report what you find.** A security finding goes privately, never into a public issue, comment or pull request.
   [SECURITY.md](../../SECURITY.md) names two routes: GitHub's private reporting, on since 2026-11-27, and an HVL
   e-mail address that is not filled in yet. Other faults go into a GitHub issue with the «Feil» form. A fix
   is a pull request that starts with a test that fails; `main` takes changes only through a pull request with a
   green «Session gate» ([hand-off index](README.md), «Ground rules for changing the code»).

## 4. For the person responsible for Canvas

Everything here happens in HVL's **test** Canvas, never in a course with real students. Steps 1 to 3 need the address
of a test server first (section 5); which Canvas instance it will be (step 4) can be answered today.

| # | What | Where it is described |
|---|---|---|
| 1 | Paste [canvas-lti13-developer-key.json](../reference/canvas-lti13-developer-key.json) into *Developer Keys → + LTI Key → Paste JSON*, with the test server's address in place of `https://interaktiv.hvl.no` (also in `extensions[].domain`). Keep `hvl_placement` in each placement | [canvas-acceptance.md](canvas-acceptance.md), step A2; [canvas-platform-values.md](../reference/canvas-platform-values.md) §1.1; Q13 |
| 2 | Set the key's Redirect URIs field to `<test server address>/lti/launch`. The pasted JSON does not carry it | canvas-platform-values.md §1.1 |
| 3 | Turn the key on and deploy it only to a test course with one test teacher and at least two test students. Check that the three scopes are not restricted for the account | canvas-acceptance.md, steps A2, A4 and A5 |
| 4 | Report three things: the client ID, each deployment ID, and whether the instance is Instructure's test or beta environment or a separate one, with its exact address | canvas-platform-values.md §10, items 1 and 3; Q4 |
| 5 | Run the acceptance checklist with the testers: set-up, launches, Deep Linking, grades, the roster, course copy and Student View, accounts and Feide, and the automated contract checks (sections A to H) | [canvas-acceptance.md](canvas-acceptance.md) |

What the key asks Canvas for: three scopes (send a score, read a line item, read the course's member list) and
privacy level `anonymous`, so Canvas sends no names or e-mail addresses (canvas-platform-values.md §4, §8). One custom
field, `feide_login`, carries the Canvas login ID of a user who opens the picker. It is on the Deep Linking placements
only, never on a learner's launch, and the server links no accounts with it until a test launch has shown what it holds
(`feideLinking` stays `false`; Q4, D-063).

## 5. What "a real backend" means

For a first test it is stage 1 of the request to HVL IT. The full request, with the evidence for each line, is
[test-environment.md](../assurance/test-environment.md). In short (its §2 and §3):

- **A host** that runs the server image (Docker, Kubernetes or OpenShift) under the seccomp profile in
  `deploy/seccomp/` with the capability `SYS_CHROOT`. Where the runtime refuses those, the PDF export of the
  pedagogisk mappe answers 503 and the Markdown export still works.
- **Two DNS names with TLS certificates:** the app, and a separate host for uploaded files.
- **A reverse proxy** whose access log leaves out the query string.
- **PostgreSQL 16** with three database roles, **Redis 7** over TLS and **S3-compatible storage** with two buckets,
  all in the EEA.
- **A clamd** (virus scanner) with daily signatures and the two alert settings the server checks for.
- **Network:** outbound to Feide, the test Canvas and the services above, and nothing else at run time; inbound
  from the testers' browsers, and from Canvas to `/lti/keys`.
- **A secret store**, somewhere to keep the logs, and a check of `GET /healthz`.
- **A Feide registration** for the test server's address, made in Feide's Customer Portal by HVL's Feide
  administrator (Q3; [feide-values.md](../reference/feide-values.md)).
- **An image built from one commit** and handed to IT by its digest. No workflow publishes or signs an image yet
  (Q33).

The rules of a first test (its §4): made-up data only, test users only, no production Canvas, named testers, an end
date, patched by rebuilding the image, and torn down at the end. What such a test proves and what it does not is its
§6. How to install is in [docs/ops/](../ops/README.md): [docker.md](../ops/docker.md),
[database-roles.md](../ops/database-roles.md), and the [runbook](../ops/runbook.md) §2 (first deployment) and §9 (the
deployment checklist).

## 6. What the meeting should decide

The Q numbers are the open questions in [PROGRESS.md](../../PROGRESS.md), «Open questions and blockers», where each
is written out in full.

1. **Who owns it.** A system owner at HVL, and a contact who owns the test install and its list of testers (Q31).
2. **Which Canvas.** The instance used for testing, and who pastes the key and reports the IDs (Q4, Q13).
3. **Where the test server runs.** HVL on-premises or Sikt, in the EEA; whether the runtime allows the seccomp
   profile and `SYS_CHROOT`; the two DNS names; a clamd (Q5).
4. **Feide.** Who registers the tool, with which test users, and who may log in (Q3, Q29).
5. **The image.** Who builds it and where, and whether it is signed (Q33).
6. **An end date** for the test install. test-environment.md §4 proposes 2027-03-27 at the latest. On that day the
   `image-size` audit exceptions (renewed on 2026-11-27, D-148) expire, and CI fails until one of three choices is made
   ([lumi-path.md](lumi-path.md)).
7. **Who reads the code first,** which area, and the private channel for security findings (section 3;
   human-review.md §4, §5).
8. **Two small ones.** Whether a Feide ID may hold letters outside a–z before the `@` (Q32), and which secret scan
   HVL IT uses once the code lives with HVL (Q34; GitHub's own is on since 2026-11-27).

## 7. What is not asked now

Real students. A pilot with real students is stage 2, and it needs more first: the data protection officer's approval
of the DPIA input (Q6), a security review by a person, the ROS-analyse, an operations agreement and a named maintainer
(Q31), ALU's review of the studio's drafts (Q17), the manual accessibility test (`UD-031`), the 200-learner load test
and a restore drill ([docs/assurance/README.md](../assurance/README.md), «What we ask of IT, in stages»).
