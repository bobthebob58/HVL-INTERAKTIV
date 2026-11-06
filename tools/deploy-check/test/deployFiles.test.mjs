/**
 * Tests for the deployment files: the real Dockerfile, ignore file, app stack and seccomp profile pass the D-110 rules,
 * and broken copies of each are caught.
 *
 * Spec: NFR-007, MAPPE-004
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  composeProblems,
  dockerfileProblems,
  dockerignoreProblems,
  SECCOMP_FILE,
  seccompProblems,
} from '../deployRules.mjs';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const read = (file) => readFileSync(join(ROOT, file), 'utf8');
const DOCKERFILE = read('deploy/Dockerfile');
const COMPOSE = read('deploy/compose.app.yml');
const SECCOMP = readFileSync(join(ROOT, SECCOMP_FILE));

describe('[NFR-007] the deployment files keep D-110 rules', () => {
  it('[NFR-007] the real Dockerfile, ignore file, app stack and seccomp profile pass every rule', () => {
    expect(seccompProblems(SECCOMP)).toEqual([]);
    expect(dockerfileProblems(DOCKERFILE)).toEqual([]);
    expect(dockerignoreProblems(read('deploy/Dockerfile.dockerignore'))).toEqual([]);
    expect(composeProblems(COMPOSE)).toEqual([]);
  });

  it('[MAPPE-004] the vendored seccomp profile is byte for byte the hashed one, denies by default and allows the namespaces Chromium needs', () => {
    // Arrange: one changed byte, and a profile without unshare that allows by default.
    const changed = Buffer.from(
      SECCOMP.toString('utf8').replace('create user namespaces', 'create user Namespaces'),
    );
    const profile = JSON.parse(SECCOMP.toString('utf8'));
    profile.syscalls[0].names = ['clone', 'setns'];
    profile.defaultAction = 'SCMP_ACT_ALLOW';
    // Act
    const changedProblems = seccompProblems(changed);
    const narrowed = seccompProblems(Buffer.from(JSON.stringify(profile)));
    // Assert
    expect(changedProblems[0]).toMatch(/SHA-256 [0-9a-f]{64}, expected cc3e61ca/);
    expect(narrowed).toContain(`${SECCOMP_FILE}: unshare must be allowed for Chromium's sandbox`);
    expect(narrowed).toContain(`${SECCOMP_FILE}: the default must deny`);
  });

  it('[NFR-007] a base image by tag, a GitHub fetch, the CA as a layer, a sandbox switch or a root runtime is refused', () => {
    // Arrange
    const broken = DOCKERFILE.replace(/ubuntu:24\.04@sha256:[0-9a-f]{64}/, 'ubuntu:24.04')
      .replace('USER 10001:10001', 'USER root')
      .concat(
        '\nRUN git clone https://github.com/h5p/h5p-php-library\n',
        'COPY ca-bundle.crt /etc/ssl/\n',
        'ENV PDF_ALLOW_NO_SANDBOX=true\n',
        'ARG FEIDE_CLIENT_SECRET\n',
      );
    // Act
    const problems = dockerfileProblems(broken);
    // Assert
    expect(problems.map((p) => p.replace(/^Dockerfile:\d+: /, ''))).toEqual([
      'base image ubuntu:24.04 is not pinned by digest',
      'a build must never fetch GitHub content (D-110)',
      'the proxy CA may come only as the optional secret proxy_ca',
      "Chromium's sandbox must stay on (D-096)",
      'no secret may be an ARG or ENV',
      'Dockerfile: the runtime stage must end as USER 10001:10001',
    ]);
  });

  it('[NFR-007] the proxy CA as the optional BuildKit secret is accepted; continued lines are one instruction', () => {
    const text =
      'FROM scratch AS a\nRUN --mount=type=secret,id=proxy_ca,required=false \\\n' +
      '    export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca\nFROM a AS runtime\nUSER 10001:10001\n';
    expect(dockerfileProblems(text)).toEqual([]);
  });

  it('[NFR-007] the ignore file must keep .env files, .git and the fetched folders out of the context', () => {
    expect(dockerignoreProblems('**/node_modules\n.git\n')).toEqual([
      'Dockerfile.dockerignore: must exclude **/.env',
      'Dockerfile.dockerignore: must exclude **/.env.*',
      'Dockerfile.dockerignore: must exclude apps/server/var',
      'Dockerfile.dockerignore: must exclude apps/server/h5p',
    ]);
  });

  it('[NFR-007] a published database, an app on every address, a tag, a written secret or a weakened app is refused', () => {
    // Arrange
    const broken = COMPOSE.replace(
      /postgres:16-alpine@sha256:[0-9a-f]{64}/,
      "postgres:16-alpine\n    ports: ['5432:5432']",
    )
      .replace("'127.0.0.1:${HVLI_APP_PORT:-18080}:3000'", "'18080:3000'")
      .replace('URL_SIGNING_KEYS: ${URL_SIGNING_KEYS:?}', 'URL_SIGNING_KEYS: dev1=c2VjcmV0')
      .replace('  read_only: true\n', '  read_only: false\n')
      .replace('    - seccomp=./seccomp/playwright-v1.56.1.seccomp\n', '')
      .replace('cap_add: [SYS_CHROOT]', 'cap_add: [SYS_CHROOT, SYS_ADMIN]');
    // Act
    const problems = composeProblems(broken);
    // Assert
    expect(problems).toContain('compose: postgres: image is not pinned by digest');
    expect(problems).toContain('compose: postgres: only the app may be published, and only on 127.0.0.1');
    expect(problems).toContain('compose: app: only the app may be published, and only on 127.0.0.1');
    expect(problems).toContain('compose: app: URL_SIGNING_KEYS must come from the environment');
    expect(problems).toContain('compose: app: the root file system must be read-only');
    expect(problems).toContain("compose: seed: needs Playwright's seccomp profile for Chromium's sandbox");
    expect(problems).toContain(
      "compose: app: may add back only SYS_CHROOT, and only for the app (Chromium's sandbox)",
    );
    expect(problems.join('\n')).not.toContain('c2VjcmV0');
  });

  it('[NFR-007] an app step that keeps its capabilities, new privileges or root, or a sandbox switch, is refused', () => {
    // Arrange
    const broken = COMPOSE.replace('  cap_drop: [ALL]\n', '')
      .replace('    - no-new-privileges:true\n', '')
      .replace("  user: '10001:10001'\n", "  user: '0:0'\n")
      .replace('  WEB_APP: prod\n', "  WEB_APP: prod\n  PDF_ALLOW_NO_SANDBOX: 'true'\n");
    // Act
    const problems = composeProblems(broken);
    // Assert
    for (const service of ['buckets', 'migrate', 'seed', 'app'])
      expect(problems).toEqual(
        expect.arrayContaining([
          `compose: ${service}: must drop every capability`,
          `compose: ${service}: needs no-new-privileges`,
          `compose: ${service}: must run as 10001`,
          `compose: ${service}: PDF_ALLOW_NO_SANDBOX is never set`,
        ]),
      );
  });

  it('[NFR-007] plural secret names, a password in any URL and list-form environments are caught without the value', () => {
    // Arrange: the server's own key lists, a Redis URL with a password, and the list form of `environment`.
    const broken = COMPOSE.replace(
      'PSEUDONYM_SECRETS: ${PSEUDONYM_SECRETS:?}',
      'PSEUDONYM_SECRETS: 2026=c2VjcmV0',
    )
      .replace('REDIS_URL: redis://redis:6379', 'REDIS_URL: redis://:hunter2@redis:6379')
      .replace(
        '    image: redis:7-alpine',
        "    environment: ['REDIS_PASSWORD=hunter2', 'CACHE_TOKENS=abc']\n    image: redis:7-alpine",
      );
    // Act
    const problems = composeProblems(broken);
    // Assert
    expect(problems).toEqual(
      expect.arrayContaining([
        'compose: app: PSEUDONYM_SECRETS must come from the environment',
        'compose: app: REDIS_URL holds a password',
        'compose: redis: REDIS_PASSWORD must come from the environment',
        'compose: redis: CACHE_TOKENS must come from the environment',
      ]),
    );
    expect(problems.join('\n')).not.toMatch(/c2VjcmV0|hunter2|abc/);
  });

  it('[NFR-007] no service may be privileged, unconfined, share a host namespace or add a capability', () => {
    // Arrange
    const broken = COMPOSE.replace(
      '    image: redis:7-alpine',
      '    privileged: true\n    network_mode: host\n    cap_add: [NET_ADMIN]\n    image: redis:7-alpine',
    ).replace('    - no-new-privileges:true\n', '    - no-new-privileges:true\n    - seccomp=unconfined\n');
    // Act
    const problems = composeProblems(broken);
    // Assert
    expect(problems).toEqual(
      expect.arrayContaining([
        'compose: redis: never privileged or unconfined',
        "compose: redis: never shares the host's network_mode",
        "compose: redis: may add back only SYS_CHROOT, and only for the app (Chromium's sandbox)",
        'compose: app: never privileged or unconfined',
      ]),
    );
  });

  it('[NFR-007] a CA file copied into the image or an ADD from a URL is refused', () => {
    // Arrange
    const broken = DOCKERFILE.concat(
      '\nCOPY proxy.pem /usr/local/share/ca-certificates/proxy.pem\n',
      'ADD https://example.org/tool.tar.gz /opt/\n',
    );
    // Act
    const problems = dockerfileProblems(broken).map((p) => p.replace(/^Dockerfile:\d+: /, ''));
    // Assert
    expect(problems).toEqual([
      'the proxy CA may come only as the optional secret proxy_ca',
      'ADD fetches nothing from a URL (D-110: no unchecked download)',
    ]);
  });
});
