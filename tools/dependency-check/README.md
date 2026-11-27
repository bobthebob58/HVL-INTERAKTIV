# tools/dependency-check

## Purpose

Keeps dependencies reviewable and lawful to ship (`SEC-007`, `NFR-005`, decision D-029):

| Script | Fails when |
|---|---|
| `checkPins.mjs` | any `package.json` in the workspace uses a range (`^`, `~`, `*`, `>=`, a tag or a URL) instead of an exact version |
| `checkLicences.mjs` | a production dependency's licence is not on the GPL-3.0-compatible allow-list, or is unknown; or the production set it checked lacks a workspace or a declared runtime dependency (`productionSetGuard.mjs`) |
| `checkAudit.mjs` | `npm audit --omit=dev` reports a high or critical advisory without a valid exception, or an exception is incomplete, undated, dated too far ahead or written for another package (`auditExceptionRules.mjs`) |
| `checkLockfile.mjs` | a package of `package-lock.json` does not come from the npm registry's own address for its name and version, or has no SHA-512 checksum; a package with an install script is not in `allowScripts` of the root `package.json` at its exact version, or the list holds a stale entry; `.npmrc` does not set `strict-allow-scripts=true` (`installScriptRules.mjs`) |
| `checkWorkflows.mjs` | a workflow in `.github/workflows/` names an action by tag or branch instead of a commit with its version as a comment, a service image without a digest (or with another digest than `deploy/compose.app.yml`), gives its token a `write` permission, states no permissions, or checks out without `persist-credentials: false` |

## How to run

```bash
npm run check:pins
npm run check:licences
npm run check:audit
npm run check:lockfile                    # Node alone: CI runs it before `npm ci`
npm run check:workflows
npx vitest run tools/dependency-check     # the tests
```

CI runs all five on every pull request and push to `main` (`.github/workflows/ci.yml`). Once a day
`.github/workflows/audit.yml` runs `check:lockfile` and `check:audit` on the default branch without installing
anything, so an advisory published between two pushes fails a run on the day it is published (D-145).

## Accepting an advisory

Only when no fixed version can be used. Write a decision in `docs/DECISIONS.md` (context, why the
risk is acceptable, mitigation, expiry), then add one entry per advisory to `audit-exceptions.json`:

```json
{ "advisory": "GHSA-xxxx-xxxx-xxxx", "package": "name", "decision": "D-030",
  "expires": "2027-01-31", "mitigation": "Why the vulnerable path is not reachable, or what blocks it." }
```

An exception is valid up to and including its `expires` date; the check fails from the next day, and also
when an exception is no longer needed. Every entry needs all five fields. `expires` must be a real calendar date
(`YYYY-MM-DD`) at most 120 days ahead, so each exception is read again within four months; a missing or misspelt
date fails instead of counting as "not yet expired". An exception covers its advisory only for the `package` it
names: an advisory that npm reports for two packages needs an entry for each, and two entries for the same advisory
and package are refused (D-145). If `npm audit` cannot run (for example, the registry is unreachable),
the check fails with exit code 2 instead of reporting zero advisories.
A transitive advisory with a compatible fixed release is fixed with an exact `overrides` entry in the
root `package.json` instead (for example `underscore` 1.13.8, see D-030).

## The lock file and install scripts

`npm ci` installs what `package-lock.json` names, from the address it names, and trusts the checksum it names.
`check:lockfile` therefore holds every package to `https://registry.npmjs.org/<name>/-/<name>-<version>.tgz` and a
`sha512-` value. A package installed under another name (an alias) or bundled inside another package fails until a
person has reviewed it and the check has learned the case.

A dependency's install script runs on the build machine before any of our code. The root `package.json` lists the
reviewed ones in `allowScripts` as `name@version`: `true` lets the script run, `false` skips it (`fsevents`, a
macOS-only package that ships its built file). `.npmrc` sets `strict-allow-scripts=true`, so npm stops an install
that meets a script outside the list instead of running it with a notice; `deploy/Dockerfile` copies `.npmrc`, so
the image's install follows the same rule. After an upgrade of a listed package, read what its script does in the
new version and change the entry in the same commit (`npm approve-scripts <name>` writes it); `check:lockfile`
fails until the list and the lock file agree, both ways.

## Workflows

An action is written as `owner/repo@<commit> # v1.2.3`. To find the commit of a release:
`git ls-remote https://github.com/<owner>/<repo>.git refs/tags/v1.2.3` (for an annotated tag, the line ending in
`^{}`). Dependabot proposes new commits for the actions. A service image's digest is changed by hand, in the same
commit as the image in `deploy/compose.app.yml`.

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

npm's `dev` flag describes the installed tree. A copy that no installed package needs counts as dev there, yet npm
leaves such copies behind (what two optional packages skipped for the platform both depend on), and
`npm prune --omit=dev` in the image build keeps one that `package-lock.json` lists without `dev`. So
`lockFileProduction.mjs` also counts an installed copy as production when the lock file lists its folder as
production; it only adds to the set (D-148). On 2026-11-27 that was `@emnapi/runtime@1.11.3`.

The guard's tests (`test/productionSetGuard.test.mjs`) also run `checkLicences.mjs` against a fake `npm` that
reports only the root package, and check that the guard reads the same manifests as `check:pins`.
