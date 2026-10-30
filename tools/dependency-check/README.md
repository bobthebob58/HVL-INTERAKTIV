# tools/dependency-check

## Purpose

Keeps dependencies reviewable and lawful to ship (`SEC-007`, `NFR-005`, decision D-029):

| Script | Fails when |
|---|---|
| `checkPins.mjs` | any `package.json` in the workspace uses a range (`^`, `~`, `*`, `>=`, a tag or a URL) instead of an exact version |
| `checkLicences.mjs` | a production dependency's licence is not on the GPL-3.0-compatible allow-list, or is unknown; or the production set it checked lacks a workspace or a declared runtime dependency (`productionSetGuard.mjs`) |
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

An exception is valid up to and including its `expires` date; the check fails from the next day, and also
when an exception is no longer needed. If `npm audit` cannot run (for example, the registry is unreachable),
the check fails with exit code 2 instead of reporting zero advisories.
A transitive advisory with a compatible fixed release is fixed with an exact `overrides` entry in the
root `package.json` instead (for example `underscore` 1.13.8, see D-030).

## Unknown licences

A package with legacy metadata (for example `"licenses": [{"type": "BSD"}]`) fails until a person reads its
licence file and adds `name@version → SPDX ID` to `REVIEWED` in `checkLicences.mjs`, with a `WHY:` comment.

## Incomplete production set

`checkLicences.mjs` checks the packages `npm query '*'` reports. If npm does not see the workspaces, it marks them
and everything only they need as dev, the production set shrinks and the check would pass on almost nothing: in
the S5 gate a stray `node_modules/node_modules` link made it count 1 production package instead of 482 (D-113).
So before it checks licences, `productionSetGuard.mjs` reads the root `package.json`, finds the workspaces its
`workspaces` names (`dir/*` or a plain folder; any other pattern stops the check until the guard learns it), and
fails when the set lacks any workspace, or any package in the `dependencies` of the root or a workspace
manifest. Each message names the package, the workspace it is or the manifests that declare it, and the likely
cause. An entry npm reports without a package name (a link to a folder outside the tree) fails too. There is no
minimum count to keep up to date: the manifests are the expectation. To fix it, remove the stray link (or the
stale install) and run `npm ci`.

The guard's tests (`test/productionSetGuard.test.mjs`) also run `checkLicences.mjs` against a fake `npm` that
reports only the root package, and check that the guard reads the same manifests as `check:pins`.
