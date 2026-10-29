# Manual accessibility test results

> Requirement `UD-031`: "Results are recorded per release in `docs/accessibility/results/`." The evaluator checks
> that a dated result file exists for the release. Decision D-079: HVL/ALU run the
> [manual test protocol](../manual-test-protocol.md); CI does not and cannot produce these files.

**Status:** no manual run has been recorded yet. The first run is due before the first pilot release (S4 gate
lists it as open). Nothing in this folder may be written by a tool or filled in from the automated suite.

## Runs due

What each session's gate left for HVL to run by hand. A row changes to *Done* only with the names of its dated
result files; it is never ticked from the automated suite.

| Session | What to run | Set-ups | Status |
|---|---|---|---|
| S4 | The first complete run: J1.1–J1.9, J2 for the ten content types, the checks of §7 (`UD-031`, `NFR-003`) | AT-1, AT-2, AT-3, KB, Z400 | To do |
| S5 | The studio: J1.10–J1.13 (a pattern, its placeholders, the save choice) and J4.1–J4.4 (the **Læringsdesign** tab, the planner, `/mappe` and its downloads) | AT-1, AT-2, KB, Z400 | To do |
| S5 | The portfolio PDF with PAC and NVDA, recording the D-096 residuals: J4.5–J4.10 (`MAPPE-004`) | PDF | To do |

## One file per set-up and run

- Name: `YYYY-MM-DD-<release>-<set-up>.md`, for example `2026-11-20-v0.4.0-AT-1.md`. `<release>` is the git tag,
  or the first 8 characters of the commit SHA when there is no tag. `<set-up>` is an ID from §3 of the protocol
  (`AT-1`, `AT-2`, `AT-3`, `KB`, `Z400`, or an optional one).
- A file is never edited after the run, except to add issue links. A re-test is a new file.
- Tester: a role and initials (for example "ALU, KH"), not a full name. Results contain no student data.

## Template

```markdown
# <set-up ID> — <release> — <YYYY-MM-DD>

| | |
|---|---|
| Release | <tag or commit> on <server> |
| Tester | <role, initials>; daily user of this assistive technology: yes/no |
| Assistive technology | <name and exact version> |
| Browser and platform | <name and exact version>, <OS and version>, <device> |
| Settings | <as listed in protocol §3, and any change> |
| Language runs | nn / en |

## Results

| Step | Result | Notes (what was announced or shown; WCAG criterion if it failed) | Issue |
|---|---|---|---|
| J1.1 | Pass / Pass with remark / Fail / Blocked / Not run | | |
| … | | | |
| J2.1 (H5P.MultiChoice) | | | |
| … | | | |
| §7 Skip link | | | |
| … | | | |

## Barriers found

| ID | Where (page, content type and version) | WCAG criterion | Impact for the user | Upstream? | Issue |
|---|---|---|---|---|---|

## Summary

<Two or three sentences: could the tasks be completed with this set-up, and what most needs fixing.>
```

## Rules for honest results

- Record only what was observed in the run. "Not run" is an allowed result; a guess is not.
- A step that passes only with a workaround (for example switching the screen reader to focus mode by hand where
  it should switch itself) is "Pass with remark", with the workaround written down.
- Known H5P problems (protocol §8) are recorded like any other barrier, with their impact in this set-up.
