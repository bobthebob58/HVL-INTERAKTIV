/**
 * deployRules — static checks of the deployment files: the vendored seccomp profile's hash, the Dockerfile's pins,
 * user and secret handling, and the app stack's digests, ports and hardening.
 *
 * Why: the image and the stack must keep D-110's rules (images by digest, no GitHub content in a build, the proxy CA
 *      only as a secret, a non-root user, Chromium's sandbox through Playwright's seccomp profile, nothing published
 *      but the app on 127.0.0.1, no secret in a file). These are cheap to check on every test run and before every
 *      smoke build, long before a slow build would show them (NFR-007, MAPPE-004).
 * Spec: NFR-007, MAPPE-004
 * Invariants:
 *   - Pure checks of file contents: each function returns problems as text and an empty list when all is well.
 *   - SECURITY: a problem names a key or a line number, never a value that could be a secret.
 *   - SECURITY: no service may be privileged, unconfined, share a host namespace or add a capability; only the app
 *     adds back SYS_CHROOT (Chromium's sandbox, D-110 amendment of 2026-11-05).
 * Collaborators: ./checkDeployFiles.mjs, deploy/Dockerfile, deploy/Dockerfile.dockerignore, deploy/compose.app.yml,
 *   deploy/seccomp/, yaml.
 * Tests: tools/deploy-check/test/deployFiles.test.mjs
 */
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

/** The vendored profile: Playwright v1.56.1's `utils/docker/seccomp_profile.json`, byte for byte (D-110). */
export const SECCOMP_FILE = 'deploy/seccomp/playwright-v1.56.1.seccomp';
/** Its SHA-256, read when it was fetched with git (deploy/seccomp/README.md). */
export const SECCOMP_SHA256 = 'cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849';
/** The user the image and the stack run as. */
export const APP_UID = '10001';

const DIGEST = /@sha256:[0-9a-f]{64}$/;
// WHY: plural names too: `PSEUDONYM_SECRETS` and `URL_SIGNING_KEYS` are this server's own key lists.
const SECRET_KEY = /(PASSWORDS?|PASSWD|SECRETS?|KEYS?|TOKENS?|CREDENTIALS?)$/;
// A URL with a password in its user part (`postgresql://user:password@host`, `redis://:password@host`).
const URL_WITH_PASSWORD = /^[a-z][a-z0-9+.-]*:\/\/[^/@]*:[^/@]+@/i;
// SECURITY: settings that undo the container's isolation, refused for every service.
const UNCONFINED = /^(seccomp|apparmor)[=:]unconfined$|^label[=:]disable$/;
const HOST_NAMESPACES = ['network_mode', 'pid', 'ipc', 'userns_mode', 'uts'];

/**
 * Checks the seccomp profile against its pinned hash and its one purpose.
 * @param {Buffer} bytes - The profile file.
 * @returns {string[]} Problems.
 */
export function seccompProblems(bytes) {
  const problems = [];
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== SECCOMP_SHA256) problems.push(`${SECCOMP_FILE}: SHA-256 ${hash}, expected ${SECCOMP_SHA256}`);
  const profile = JSON.parse(bytes.toString('utf8'));
  if (profile.defaultAction !== 'SCMP_ACT_ERRNO') problems.push(`${SECCOMP_FILE}: the default must deny`);
  const allowed = new Set(
    profile.syscalls
      .filter(
        (rule) => rule.action === 'SCMP_ACT_ALLOW' && (rule.args ?? []).length === 0 && !rule.includes?.caps,
      )
      .flatMap((rule) => rule.names),
  );
  for (const name of ['clone', 'setns', 'unshare'])
    if (!allowed.has(name)) problems.push(`${SECCOMP_FILE}: ${name} must be allowed for Chromium's sandbox`);
  return problems;
}

/**
 * Joins a Dockerfile's continued lines and drops its comments.
 * @param {string} text - The Dockerfile.
 * @returns {{ line: number, text: string }[]} One entry per instruction, with the line it starts on.
 */
export function dockerInstructions(text) {
  const instructions = [];
  let current;
  text.split('\n').forEach((raw, index) => {
    if (!current && (raw.trim() === '' || raw.trimStart().startsWith('#'))) return;
    const piece = raw.replace(/\\\s*$/, '');
    current = current
      ? { ...current, text: `${current.text} ${piece.trim()}` }
      : { line: index + 1, text: piece.trim() };
    if (!/\\\s*$/.test(raw)) {
      instructions.push(current);
      current = undefined;
    }
  });
  return instructions;
}

/**
 * Checks the Dockerfile: base images by digest, the runtime's user, no GitHub content, the CA only as a secret.
 * @param {string} text - deploy/Dockerfile.
 * @returns {string[]} Problems.
 */
export function dockerfileProblems(text) {
  const problems = [];
  const stages = new Set();
  const instructions = dockerInstructions(text);
  for (const { line, text: instruction } of instructions) {
    const from = /^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i.exec(instruction);
    if (from) {
      const image = from[1];
      if (image !== 'scratch' && !stages.has(image) && !DIGEST.test(image))
        problems.push(`Dockerfile:${line}: base image ${image} is not pinned by digest`);
      if (from[2]) stages.add(from[2]);
    }
    if (/github\.com|githubusercontent|git (clone|fetch)/i.test(instruction))
      problems.push(`Dockerfile:${line}: a build must never fetch GitHub content (D-110)`);
    if (/PDF_ALLOW_NO_SANDBOX|--no-sandbox/.test(instruction))
      problems.push(`Dockerfile:${line}: Chromium's sandbox must stay on (D-096)`);
    if (
      /proxy_ca|ca-bundle|NODE_EXTRA_CA_CERTS|\.(crt|pem)\b|update-ca-certificates/.test(instruction) &&
      !/--mount=type=secret,id=proxy_ca,required=false/.test(instruction)
    )
      problems.push(`Dockerfile:${line}: the proxy CA may come only as the optional secret proxy_ca`);
    if (/^ADD\s+(?:--\S+\s+)*\S*:\/\//i.test(instruction))
      problems.push(`Dockerfile:${line}: ADD fetches nothing from a URL (D-110: no unchecked download)`);
    const declared = /^(?:ARG|ENV)\s+(.*)$/i.exec(instruction)?.[1].split(/\s+/) ?? [];
    if (declared.some((pair) => SECRET_KEY.test(pair.split('=')[0])))
      problems.push(`Dockerfile:${line}: no secret may be an ARG or ENV`);
  }
  const runtime = instructions.slice(instructions.findLastIndex((i) => /^FROM\s/i.test(i.text)));
  const finalUser = runtime.filter((i) => /^USER\s/i.test(i.text)).at(-1);
  if (finalUser?.text !== `USER ${APP_UID}:${APP_UID}`)
    problems.push(`Dockerfile: the runtime stage must end as USER ${APP_UID}:${APP_UID}`);
  return problems;
}

/**
 * Checks the ignore file: local secrets and fetched folders never reach the build context.
 * @param {string} text - deploy/Dockerfile.dockerignore.
 * @returns {string[]} Problems.
 */
export function dockerignoreProblems(text) {
  const lines = new Set(text.split('\n').map((l) => l.trim()));
  return ['**/.env', '**/.env.*', '.git', '**/node_modules', 'apps/server/var', 'apps/server/h5p']
    .filter((pattern) => !lines.has(pattern))
    .map((pattern) => `Dockerfile.dockerignore: must exclude ${pattern}`);
}

// WHY: compose takes `environment` as a map or as a list of `NAME=value`; both must be checked.
const environmentOf = (service) =>
  Array.isArray(service.environment)
    ? service.environment.map((entry) => {
        const [key, ...value] = String(entry).split('=');
        return [key, value.join('=')];
      })
    : Object.entries(service.environment ?? {});

/**
 * Checks the app stack: digests, published ports, the app's hardening and no secret written in the file.
 * @param {string} text - deploy/compose.app.yml.
 * @returns {string[]} Problems.
 */
export function composeProblems(text) {
  const problems = [];
  const { services } = parse(text, { merge: true });
  for (const [name, service] of Object.entries(services)) {
    const image = String(service.image ?? '');
    if (!image.startsWith('${HVLI_IMAGE') && !DIGEST.test(image))
      problems.push(`compose: ${name}: image is not pinned by digest`);
    for (const port of service.ports ?? [])
      if (name !== 'app' || !String(port).startsWith('127.0.0.1:'))
        problems.push(`compose: ${name}: only the app may be published, and only on 127.0.0.1`);
    for (const [key, value] of environmentOf(service)) {
      if (key === 'PDF_ALLOW_NO_SANDBOX')
        problems.push(`compose: ${name}: PDF_ALLOW_NO_SANDBOX is never set`);
      const literal = String(value).replace(/\$\{[^}]+\}/g, '');
      if (SECRET_KEY.test(key) && literal !== '')
        problems.push(`compose: ${name}: ${key} must come from the environment`);
      if (/URL$/.test(key) && URL_WITH_PASSWORD.test(literal))
        problems.push(`compose: ${name}: ${key} holds a password`);
    }
    const options = (service.security_opt ?? []).map(String);
    if (service.privileged === true || options.some((option) => UNCONFINED.test(option)))
      problems.push(`compose: ${name}: never privileged or unconfined`);
    for (const key of HOST_NAMESPACES)
      if (String(service[key] ?? '').startsWith('host'))
        problems.push(`compose: ${name}: never shares the host's ${key}`);
    for (const capability of service.cap_add ?? [])
      if (name !== 'app' || capability !== 'SYS_CHROOT')
        problems.push(
          `compose: ${name}: may add back only SYS_CHROOT, and only for the app (Chromium's sandbox)`,
        );
    if (image.startsWith('${HVLI_IMAGE')) {
      if (String(service.user) !== `${APP_UID}:${APP_UID}`)
        problems.push(`compose: ${name}: must run as ${APP_UID}`);
      if (service.read_only !== true)
        problems.push(`compose: ${name}: the root file system must be read-only`);
      if (!(service.cap_drop ?? []).includes('ALL'))
        problems.push(`compose: ${name}: must drop every capability`);
      if (!options.includes('no-new-privileges:true'))
        problems.push(`compose: ${name}: needs no-new-privileges`);
      if (!options.includes('seccomp=./seccomp/playwright-v1.56.1.seccomp'))
        problems.push(`compose: ${name}: needs Playwright's seccomp profile for Chromium's sandbox`);
    }
  }
  return problems;
}
