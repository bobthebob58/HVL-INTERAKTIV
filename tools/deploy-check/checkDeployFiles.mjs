/**
 * checkDeployFiles — `node tools/deploy-check/checkDeployFiles.mjs`: runs the static deployment checks on the
 * repository's Dockerfile, ignore file, app stack and seccomp profile.
 *
 * Why: the smoke script runs this before its slow build, so a broken pin, a published database port or a changed
 *      seccomp profile stops it in a second (NFR-007, D-110). The same checks run in `npm test`.
 * Spec: NFR-007, MAPPE-004
 * Invariants:
 *   - Exit code 0 only when every check passes; otherwise one `✗` line per problem and exit code 1.
 *   - Reads files only; no network, no Docker.
 * Usage: checkDeployFiles.mjs [--root <repository>]
 * Collaborators: ./deployRules.mjs, deploy/smoke/dockerSmoke.sh.
 * Tests: tools/deploy-check/test/deployFiles.test.mjs (the rules, on the real files and on broken copies)
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
];
for (const problem of problems) console.error(`✗ ${problem}`);
if (problems.length > 0) process.exitCode = 1;
else
  console.log('✓ deploy files: pins, user, ports, hardening and the seccomp profile are as D-110 sets them');
