/**
 * checkDeployFiles — `node tools/deploy-check/checkDeployFiles.mjs`: runs the static deployment checks on the
 * repository's Dockerfile, ignore file, app stack and seccomp profile.
 *
 * Why: the smoke script runs this before its slow build, so a broken pin, a published database port, a changed
 *      seccomp profile or a missing restart rule or memory limit stops it in a second (NFR-007, D-110, D-134). The
 *      same checks run in `npm test`.
 * Spec: NFR-007, MAPPE-004, NFR-002
 * Invariants:
 *   - Exit code 0 only when every check passes; otherwise one `✗` line per problem and exit code 1.
 *   - Reads files only; no network, no Docker.
 * Usage: checkDeployFiles.mjs [--root <repository>]
 * Collaborators: ./deployRules.mjs, ./resourceRules.mjs, deploy/smoke/dockerSmoke.sh.
 * Tests: tools/deploy-check/test/deployFiles.test.mjs and tools/deploy-check/test/resourceRules.test.mjs (the
 *   rules, on the real files and on broken copies)
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  composeProblems,
  dockerfileProblems,
  dockerignoreProblems,
  SECCOMP_FILE,
  seccompProblems,
} from './deployRules.mjs';
import { resourceProblems } from './resourceRules.mjs';

const args = process.argv.slice(2);
const root = resolve(
  args.includes('--root')
    ? args[args.indexOf('--root') + 1]
    : fileURLToPath(new URL('../..', import.meta.url)),
);
const read = (file) => readFileSync(join(root, file), 'utf8');

const problems = [
  ...seccompProblems(readFileSync(join(root, SECCOMP_FILE))),
  ...dockerfileProblems(read('deploy/Dockerfile')),
  ...dockerignoreProblems(read('deploy/Dockerfile.dockerignore')),
  ...composeProblems(read('deploy/compose.app.yml')),
  ...resourceProblems(read('deploy/compose.app.yml')),
];
for (const problem of problems) console.error(`✗ ${problem}`);
if (problems.length > 0) process.exitCode = 1;
else
  console.log(
    '✓ deploy files: pins, user, ports, hardening, the seccomp profile and the limits are as D-110 and D-134 set them',
  );
