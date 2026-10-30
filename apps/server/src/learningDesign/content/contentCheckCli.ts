/**
 * contentCheckCli — `npm run content:check [-- --root=<content folder>]`: checks the studio content in `content/`
 * without starting the server, and exits 1 on any problem.
 *
 * Why: CI and the pre-commit hook (lint-staged on `content/**`) must refuse a broken content file before it is merged
 *      or deployed, with the same loader and the same messages as the server's start-up (D-082). The command also
 *      checks the pattern skeletons against the pinned libraries `npm run h5p:fetch-libraries` installs, which the
 *      server's start-up does not (D-084 amendment).
 * Spec: PED-001, PED-011
 * Invariants:
 *   - Needs no environment, database or network; reads only the content folder and the installed library folder.
 *   - A relative `--root` is resolved from the folder `npm run` was started in (`INIT_CWD`), not the workspace.
 *   - Without the installed libraries the skeleton library checks are skipped and the summary says so; in CI
 *     (`CI=true`) that is a problem instead, so CI never passes a skeleton it did not check.
 * Collaborators: ./runContentCheck.ts, ./installedLibraries.ts; package.json (`content:check` here and at the
 *   repository root), .github/workflows/ci.yml, lint-staged in the root package.json.
 * Tests: apps/server/test/learningDesign/content/runContentCheck.test.ts (runs this file).
 */
import { readInstalledLibraries } from './installedLibraries.js';
import { runContentCheck } from './runContentCheck.js';

// WHY: npm runs a workspace script in the workspace folder and records where the user typed the command in INIT_CWD.
process.exitCode = runContentCheck(process.argv.slice(2), {
  baseDirectory: process.env.INIT_CWD ?? process.cwd(),
  inputs: { installedLibraries: readInstalledLibraries(undefined, process.env.CI === 'true') },
});
