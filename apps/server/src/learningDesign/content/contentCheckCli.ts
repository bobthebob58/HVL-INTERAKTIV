/**
 * contentCheckCli — `npm run content:check [-- --root=<content folder>]`: checks the studio content in `content/`
 * without starting the server, and exits 1 on any problem.
 *
 * Why: CI and the pre-commit hook (lint-staged on `content/**`) must refuse a broken content file before it is merged
 *      or deployed, with the same loader and the same messages as the server's start-up (D-082).
 * Spec: PED-001
 * Invariants:
 *   - Needs no environment, database or network; reads only the content folder.
 *   - A relative `--root` is resolved from the folder `npm run` was started in (`INIT_CWD`), not the workspace.
 * Collaborators: ./runContentCheck.ts; package.json (`content:check` here and at the repository root),
 *   .github/workflows/ci.yml, lint-staged in the root package.json.
 * Tests: apps/server/test/learningDesign/content/runContentCheck.test.ts (runs this file).
 */
import { runContentCheck } from './runContentCheck.js';

// WHY: npm runs a workspace script in the workspace folder and records where the user typed the command in INIT_CWD.
process.exitCode = runContentCheck(process.argv.slice(2), {
  baseDirectory: process.env.INIT_CWD ?? process.cwd(),
});
