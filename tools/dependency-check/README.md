# tools/dependency-check

## Purpose

Keeps dependencies reviewable and lawful to ship (`SEC-007`, `NFR-005`, decision D-029):

| Script | Fails when |
|---|---|
| `checkPins.mjs` | any `package.json` in the workspace uses a range (`^`, `~`, `*`, `>=`, a tag or a URL) instead of an exact version |
| `checkLicences.mjs` | a production dependency's licence is not on the GPL-3.0-compatible allow-list, or is unknown |
| `checkAudit.mjs` | `npm audit --omit=dev` reports a high or critical advisory without a valid exception |

## How to run

```bash
npm run check:pins
npm run check:licences
npm run check:audit
npx vitest run tools/dependency-check     # the tests
```

## Accepting an advisory

Only when no fixed version can be used. Write a decision in `docs/DECISIONS.md` (context, why the
risk is acceptable, mitigation, expiry), then add one entry per advisory to `audit-exceptions.json`:

```json
{ "advisory": "GHSA-xxxx-xxxx-xxxx", "package": "name", "decision": "D-030",
  "expires": "2027-01-31", "mitigation": "Why the vulnerable path is not reachable, or what blocks it." }
```

The check fails again on the expiry date, and also when an exception is no longer needed.
A transitive advisory with a compatible fixed release is fixed with an exact `overrides` entry in the
root `package.json` instead (for example `underscore` 1.13.8, see D-030).

## Unknown licences

A package with legacy metadata (for example `"licenses": [{"type": "BSD"}]`) fails until a person reads its
licence file and adds `name@version → SPDX ID` to `REVIEWED` in `checkLicences.mjs`, with a `WHY:` comment.
