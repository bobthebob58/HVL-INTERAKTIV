# tools/issue-forms

## Purpose

Checks the pilot's problem reporting on GitHub (D-101's amendment of 2026-11-05): the two issue forms in
`.github/ISSUE_TEMPLATE/` (`feil.yml`, a fault; `uu-barriere.yml`, an accessibility barrier), the chooser's
`config.yml` and the label list `.github/labels.yml`. GitHub checks a form only when someone opens it and leaves off
any label that does not exist, so a broken form would only be noticed by a tester. These tests notice it first.

| Test (`[ID]`) | What fails |
|---|---|
| `NFR-004` | a file that is not clean YAML 1.1 (duplicate keys, a colour read as a number); a key, field type or attribute GitHub's form schema does not have; a duplicate field `id` or label; a form label missing from `labels.yml`; a severity choice without its `alvor N: …` label; a label the tester guide or the triage document does not name; a link to a file that does not exist or to another repository |
| `DATA-010` | a form that does not open with the rule against personal data and a required confirmation; blank issues turned on; a field that asks for a name or a contact detail; an assistive-technology field that does not say the reason for using it is not needed (health data) |
| `DATA-009` | the fault form's log-lines field not a code block, or required |
| `NFR-003` | a form that does not require the device, the browser, the assistive technology and the zoom |
| `UD-031` | the barrier form not offering every set-up of the manual protocol (§3), or no field for the dated result file |
| `PROD-002` | a form whose activity types are not exactly the ten authorable types, by the web app's Nynorsk names |

The guide for testers is [docs/testing/rapportere-problem.md](../../docs/testing/rapportere-problem.md) (Nynorsk);
labels and triage for maintainers are in [docs/testing/labels-and-triage.md](../../docs/testing/labels-and-triage.md).

## How to run

```bash
npx vitest run tools/issue-forms     # the checks, against the real files
```

## Folder structure

| Path | Responsibility |
|---|---|
| `issueFormRules.mjs` | Pure checks: GitHub's form schema, the chooser's config and the label list, read as YAML 1.1 |
| `test/issueFormFiles.mjs` | Loads the real forms, config and label list once for both test files |
| `test/issueFormSyntax.test.mjs` | `NFR-004`: the checks pass on the real files and catch broken examples; labels named in the documents; links |
| `test/issueFormContent.test.mjs` | What the forms ask for: `NFR-004`, `DATA-010`, `DATA-009`, `NFR-003`, `UD-031`, `PROD-002` |
