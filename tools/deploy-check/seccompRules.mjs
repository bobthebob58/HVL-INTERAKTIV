/**
 * seccompRules — static checks of the seccomp profile the app container runs under: it is Docker's own default
 * profile, byte for byte, with one rule added for Chromium's sandbox.
 *
 * Why: under Docker's default profile Chromium cannot create the user namespaces of its sandbox (D-096, D-110). The
 *      profile Playwright publishes for that is an old copy of Docker's default: besides the three namespace calls
 *      it still allows `io_uring` and every kind of `socket`, which Docker's default has since taken away, and
 *      Playwright has not updated it. So the profile here starts from Docker's current default and adds only what
 *      the sandbox needs, and these checks keep it that way (D-144).
 * Spec: NFR-007, MAPPE-004
 * Invariants:
 *   - The file has the pinned hash, and with the one added rule taken out it has the hash of Docker's default
 *     (`default.json` of the pinned release, deploy/seccomp/README.md): nothing else was added or changed.
 *   - The default denies; `clone`, `setns` and `unshare` are allowed without a condition.
 *   - SECURITY: no rule allows an `io_uring` call, and `socket` is allowed only with a condition on its address
 *     family, as in Docker's default.
 *   - Pure checks of file contents: the function returns problems as text and an empty list when all is well.
 * Collaborators: ./checkDeployFiles.mjs, ./deployRules.mjs (the stack must name this file), deploy/seccomp/.
 * Tests: tools/deploy-check/test/seccompRules.test.mjs
 */
import { createHash } from 'node:crypto';

/** The profile the app's containers run under. */
export const SECCOMP_FILE = 'deploy/seccomp/chromium-sandbox.seccomp';
/** The profile's SHA-256. */
export const SECCOMP_SHA256 = '42127de905b5c57c10e93d012dfe89bd494b03de7e122734900157e64d938017';
/** The SHA-256 of Docker's default profile at the pinned release (deploy/seccomp/README.md). */
export const DOCKER_DEFAULT_SHA256 = '785b2429264afba4d594320337cb17f144f3c7d51585f9805eef72e28f4f9334';
/** The calls the added rule allows: Chromium's sandbox creates and enters user namespaces with them. */
export const NAMESPACE_CALLS = ['clone', 'setns', 'unshare'];

const TAB = '\t';
/** The one rule added to Docker's default, exactly as it stands in the file, right after `"syscalls": [`. */
export const ADDED_RULE = [
  `${TAB.repeat(2)}{`,
  `${TAB.repeat(3)}"names": [`,
  ...NAMESPACE_CALLS.map(
    (name, index) => `${TAB.repeat(4)}"${name}"${index < NAMESPACE_CALLS.length - 1 ? ',' : ''}`,
  ),
  `${TAB.repeat(3)}],`,
  `${TAB.repeat(3)}"action": "SCMP_ACT_ALLOW",`,
  `${TAB.repeat(3)}"comment": "HVL Interaktiv: lets Chromium's sandbox create its user namespaces (D-096). The only rule added to Docker's default profile."`,
  `${TAB.repeat(2)}},`,
  '',
].join('\n');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The rules that allow a call, whatever their conditions. */
const allowing = (profile, name) =>
  profile.syscalls.filter((rule) => rule.action === 'SCMP_ACT_ALLOW' && rule.names.includes(name));

const unconditional = (rule) => (rule.args ?? []).length === 0 && !rule.includes && !rule.excludes;

/**
 * Checks the seccomp profile: its hash, that it is Docker's default plus the one rule, and what it allows.
 * @param {Buffer} bytes - The profile file.
 * @returns {string[]} Problems.
 */
export function seccompProblems(bytes) {
  const problems = [];
  const hash = sha256(bytes);
  if (hash !== SECCOMP_SHA256) problems.push(`${SECCOMP_FILE}: SHA-256 ${hash}, expected ${SECCOMP_SHA256}`);
  const text = bytes.toString('utf8');
  const parts = text.split(ADDED_RULE);
  if (parts.length !== 2 || !parts[0].endsWith('"syscalls": [\n'))
    problems.push(`${SECCOMP_FILE}: the added rule must stand once, first among the rules, as written`);
  else if (sha256(Buffer.from(parts.join(''), 'utf8')) !== DOCKER_DEFAULT_SHA256)
    problems.push(
      `${SECCOMP_FILE}: without the added rule it must be Docker's default profile, byte for byte`,
    );
  const profile = JSON.parse(text);
  if (profile.defaultAction !== 'SCMP_ACT_ERRNO') problems.push(`${SECCOMP_FILE}: the default must deny`);
  for (const name of NAMESPACE_CALLS)
    if (!allowing(profile, name).some(unconditional))
      problems.push(`${SECCOMP_FILE}: ${name} must be allowed for Chromium's sandbox`);
  // SECURITY: what the old profile allowed beyond Docker's default must not come back with a later edit.
  const names = new Set(profile.syscalls.flatMap((rule) => rule.names));
  for (const name of [...names].filter((call) => call.startsWith('io_uring')))
    if (allowing(profile, name).length > 0) problems.push(`${SECCOMP_FILE}: ${name} must not be allowed`);
  if (allowing(profile, 'socket').some((rule) => (rule.args ?? []).length === 0))
    problems.push(`${SECCOMP_FILE}: socket must be allowed only by address family, as in Docker's default`);
  return problems;
}
