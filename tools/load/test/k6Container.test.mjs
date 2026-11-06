/**
 * k6Container.test — the `docker run` arguments of a load run (image by digest, read-only scripts and file system,
 * one writable folder, no other environment, no usage report), the runner's arguments, and the redaction of k6's
 * output, also when a pipe cuts a token in two.
 * Spec: NFR-001, LTI-003
 */
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { K6_IMAGE, k6DockerArgs, pipeRedactedLines, redactTokens } from '../k6Container.mjs';
import { loadArgs } from '../runLoad.mjs';

const RUN = {
  k6Dir: '/repo/tools/load/k6/',
  outDir: '/tmp/load-out',
  profile: 'smoke',
  uid: 1001,
  gid: 1002,
};

describe('the k6 container of a load run', () => {
  it('[NFR-001] runs k6 2.3.0 by digest on the host network as the caller', () => {
    // Act
    const args = k6DockerArgs(RUN);

    // Assert
    expect(K6_IMAGE).toBe(
      'grafana/k6:2.3.0@sha256:2dd4756ec6e14e62778916e1eb850108e4b499304c02df56760fa0bdb0fba0b8',
    );
    expect(args.slice(0, 6)).toEqual(['run', '--rm', '--network', 'host', '--user', '1001:1002']);
    expect(args.slice(args.indexOf(K6_IMAGE))).toEqual([
      K6_IMAGE,
      'run',
      '--quiet',
      '--no-usage-report',
      '/scripts/visit.js',
    ]);
  });

  it('[NFR-001] mounts the scripts read-only, one output folder, and gives only HVLI_LOAD_* variables', () => {
    // Act
    const args = k6DockerArgs(RUN);
    const after = (flag) => args.flatMap((arg, i) => (arg === flag ? [args[i + 1]] : []));

    // Assert
    expect(after('--volume')).toEqual(['/repo/tools/load/k6/:/scripts:ro', '/tmp/load-out:/out']);
    expect(after('--env')).toEqual([
      'HVLI_LOAD_PROFILE=smoke',
      'HVLI_LOAD_ADDRESSES=/out/learners.json',
      'HVLI_LOAD_OUT=/out',
    ]);
    expect(args).not.toContain('--env-file');
    expect(args.some((arg) => arg.startsWith('-e'))).toBe(false);
    expect(after('--cap-drop')).toEqual(['ALL']);
    expect(after('--security-opt')).toEqual(['no-new-privileges']);
    expect(args.indexOf('--read-only')).toBeGreaterThan(-1);
    expect(args.indexOf('--read-only')).toBeLessThan(args.indexOf(K6_IMAGE));
  });

  it('[LTI-003] removes ltiks, Bearer tokens and JWTs from k6 output', () => {
    // Arrange
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl';
    const line =
      `WARN Request Failed error="Post \\"http://localhost:1/h5p/contentUserData/a/state/0?contextId=c&ltik=${jwt}` +
      `&contentVersion=1\\": EOF" header="Authorization: Bearer ${jwt}" token ${jwt}`;

    // Act
    const shown = redactTokens(line);

    // Assert
    expect(shown).not.toContain(jwt);
    expect(shown).not.toContain('eyJ');
    expect(shown).toContain('ltik=…&contentVersion=1');
    expect(shown).toContain('Bearer …');
  });

  it('[LTI-003] redacts a token that a pipe cuts across two chunks of k6 output', async () => {
    // Arrange: the cut falls inside the ltik, so neither piece holds a whole token
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl';
    const line = `WARN Request Failed url=/h5p/contentUserData/a/state/0?ltik=${jwt}&contentVersion=1\n`;
    const cut = line.indexOf(jwt) + 12;
    const [from, to] = [new PassThrough(), new PassThrough()];
    const shown = [];
    to.on('data', (chunk) => shown.push(chunk));

    // Act
    const piping = pipeRedactedLines(from, to);
    from.write(line.slice(0, cut));
    from.end(line.slice(cut));
    await piping;

    // Assert
    const text = Buffer.concat(shown).toString('utf8');
    expect(text).not.toContain('c2lnbmF0dXJl');
    expect(text).not.toContain('eyJ');
    expect(text).toBe('WARN Request Failed url=/h5p/contentUserData/a/state/0?ltik=…&contentVersion=1\n');
  });

  it('[NFR-001] reads the profile and output folder, with a dated default folder', () => {
    // Act
    const chosen = loadArgs(['--profile', 'full', '--out', '/srv/load']);
    const dated = loadArgs(['--profile', 'smoke'], new Date('2026-11-05T04:58:00.123Z'));

    // Assert
    expect(chosen).toEqual({ profile: 'full', outDir: '/srv/load' });
    expect(dated.outDir).toMatch(/hvli-load-smoke-20261105T045800Z$/);
    expect(() => loadArgs([])).toThrow(/smoke or full/);
    expect(() => loadArgs(['--profile', 'smoke', '--vus', '9'])).toThrow();
  });
});
