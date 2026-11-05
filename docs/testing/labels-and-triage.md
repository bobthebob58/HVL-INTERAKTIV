# Labels and triage for the pilot's problem reports

For the people who maintain HVL Interaktiv during the pilot: HVL's developers, operations (HVL IT) and the bachelor
students who take over the code in spring 2027. The testers' guide is in Nynorsk:
[rapportere-problem.md](rapportere-problem.md). The decision is D-101's amendment of 2026-11-05 in
[DECISIONS.md](../DECISIONS.md) (problem reporting).

## What is where

| File | What it holds |
|---|---|
| `.github/ISSUE_TEMPLATE/feil.yml` | The form for a fault («Feil») |
| `.github/ISSUE_TEMPLATE/uu-barriere.yml` | The form for an accessibility barrier («Barriere for universell utforming») |
| `.github/ISSUE_TEMPLATE/config.yml` | The chooser: blank issues off, links to the guide and to the security policy |
| `.github/labels.yml` | The labels below, with colours from `packages/design-tokens` and Nynorsk descriptions |
| [`SECURITY.md`](../../SECURITY.md) | The private route for security problems, with HVL's contact (the owner fills it in) |
| `tools/issue-forms/` | The checks: the forms are valid for GitHub, use only listed labels, ask what a fix needs, and keep personal data out (`npx vitest run tools/issue-forms`) |

## The labels

The names are Nynorsk, as in the forms; the meaning is in the name, never in the colour alone.

| Label | Meaning | Set by |
|---|---|---|
| `type: feil` | A fault: something does not work as it should | The fault form |
| `type: universell utforming` | An accessibility barrier | The barrier form |
| `alvor 1: kritisk` | Someone cannot use it at all, or it concerns privacy or security; fixed first | Triage, from the reporter's choice |
| `alvor 2: UU-barriere` | Someone is hindered or misses information (with assistive technology, low vision, no sound), but can go on | Triage, from the reporter's choice |
| `alvor 3: kosmetisk` | Looks wrong, everyone can still use it | Triage, from the reporter's choice |
| `treng vurdering` | New; nobody has looked at it yet | Both forms |
| `treng meir informasjon` | Waiting for the reporter | Triage |
| `stadfesta` | Reproduced in the test set-up; the failing test comes next | Whoever reproduced it |
| `treng HVL-test` | Only HVL can see or test it: HVL's Canvas or Feide, a device or a screen reader; also the re-test after the fix | Triage |
| `H5P oppstraums` | The cause is in H5P's own code (D-080) | Triage |

A form adds its type label and `treng vurdering`. It cannot add a label from a dropdown choice, so the severity label
is set by the person who triages, to match the reporter's choice; a changed severity gets a comment that says why.
The repository's other labels stay as they are: GitHub's defaults (`bug`, `enhancement` and the rest) for development
work, and `dependencies`, `javascript` and `github_actions`, which Dependabot sets. The older `accessibility` label
overlaps `type: universell utforming`; the owner decides whether to keep it, and pilot issues do not use it.

### Creating the labels (owner, once, and after any change to `labels.yml`)

GitHub adds a form's labels only if they already exist, so create them before the pilot. From the repository root,
with `npm ci` done and `gh` signed in with write access:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
for (const l of parse(readFileSync('.github/labels.yml', 'utf8'))) console.log([l.name, l.color, l.description].join('\t'));
" | while IFS=$'\t' read -r name color description; do
  gh label create "$name" --color "$color" --description "$description" --force
done
```

`--force` updates a label that exists. Nothing is deleted; remove a label by hand if `labels.yml` drops it.

## Triage, step by step

1. **Personal data first.** If an issue, a comment or a screenshot shows a name, an e-mail address, a Feide ID, a
   national identity or student number, a student's answer, or anything about someone's health (including why a
   tester uses assistive technology): edit it out, then delete the old revision from the edit history (GitHub keeps
   every edit), or delete the issue. An uploaded image stays reachable at its URL after it is removed from the text,
   so ask GitHub Support to delete the file *(verify against GitHub's documentation on attachments)*; notification
   e-mails already sent to watchers cannot be recalled. If it is real data about someone, tell HVL's data
   protection officer the same day (runbook §7, step 3). If a security problem was posted openly, move it to a
   private security advisory, delete the issue and tell the reporter why ([SECURITY.md](../../SECURITY.md)).
2. **Severity.** Set the `alvor` label that matches the reporter's choice (the highest level that fits; a barrier
   that stops someone completely is level 1). Remove `treng vurdering`.
3. **Missing facts.** Ask in the issue and set `treng meir informasjon`.
4. **Reproduce in the test set-up**, never with production data (`DATA-010`): the local stack as *How to run* in
   [apps/server/README.md](../../apps/server/README.md) sets it up, with `npm run mock:platform` playing Canvas and
   Feide, or HVL's test server with test users. Reproduced: set `stadfesta`.
5. **Not reproduced here:**
   - *Only in HVL's Canvas or with Feide:* ask HVL IT for the error and the server's log lines around the reported
     time. The request log has one JSON line per request with `requestId`, `method`, `route` (the pattern, never the
     path or the query), `status` and `durationMs` (runbook §7). These lines hold no personal data by design
     (`DATA-009`), so they may be pasted into the issue. Only HVL Interaktiv's own JSON lines: not the reverse
     proxy's access log (client IP addresses), not Canvas's or Feide's logs, not a browser console. A line that does
     show personal data is a privacy fault: report it privately and fix it first. Set `treng HVL-test`.
   - *Only on one device, browser or screen reader:* get the exact steps, keys, what was announced and the versions.
     Fix what the description shows; HVL re-tests with the same set-up before the issue closes. Set `treng HVL-test`.
6. **H5P's own barriers** (D-080): repair at run time when an attribute-only change can remove the barrier without
   changing behaviour, in `packages/hvl-h5p-theme/src/a11yRepairs.js` (the content types) or `a11yEditorRepairs.js`
   (the editor and the hub). Otherwise, if the axe suite reports it, add an entry to
   `apps/server/a11y/support/upstreamRegister.ts` (an entry that axe never reports fails the suite); a barrier axe
   cannot see, such as a key that does nothing or a wrong announcement, gets a D-080 amendment and an
   `upstream pin:` test, as D-080's keyboard barriers have. Either way, draft the upstream report in `docs/upstream/`
   for the owner to file (D-112), regenerate the conformance report (`npm run a11y:report`) and set `H5P oppstraums`.
7. **Fix it:** a test that fails first, titled with its requirement ID (`[UD-003] …`); then the cause fixed, the
   area's tests and the session gate (Evaluator Guide §5); then a branch and a pull request with a `Refs:` footer and
   `Fixes #<issue>`, which HVL reviews and merges. Close the issue with the pull request's link; with
   `treng HVL-test`, only after HVL's re-test.
8. **Manual results** stay dated in `docs/accessibility/results/` (D-079). A result file is never edited after the
   run except to add issue links, and a re-test is a new file; link the issue from the file and the file from the
   issue.

## What GitHub does and does not do

- Required fields, and the required privacy confirmation, are enforced in public repositories only *(verify against
  GitHub's form syntax documentation)*. The repository is public today; if it becomes private, step 1 checks the
  confirmation by hand.
- A form's label that does not exist in the repository is left off without a warning; `tools/issue-forms` checks
  that every form label is in `labels.yml`, and the labels must be created as above.
- With blank issues off, development issues are opened with `gh issue create --title … --body …`; the API does not
  use the forms.
- The forms and `config.yml` link to this repository by absolute URL. If the repository moves, change every link;
  the test requires them to name one repository.
