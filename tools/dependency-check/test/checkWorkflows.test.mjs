/**
 * Tests for the workflow check (D-145): the real workflows pass, and a copy with an action named by tag, branch or
 * short commit, a commit without its version, a service image without a digest or with another digest than the app
 * stack's, a token that may write, or a checkout that keeps the token is refused.
 *
 * Spec: SEC-007
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stackDigests, workflowProblems } from '../checkWorkflows.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FOLDER = `${ROOT}.github/workflows/`;
const CI = readFileSync(`${FOLDER}ci.yml`, 'utf8');
const STACK = stackDigests(readFileSync(`${ROOT}deploy/compose.app.yml`, 'utf8'));
const CHECKOUT = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';

/** The real CI workflow with one text replaced; the test fails if the text is not there exactly once. */
const ci = (text, replacement) => {
  expect(CI.split(text)).toHaveLength(2);
  return workflowProblems('ci.yml', CI.replace(text, replacement), STACK);
};

describe('[SEC-007] the workflows name exact versions of what they run', () => {
  it('[SEC-007] the real workflows pass: actions by commit, service images by digest, a token that reads', () => {
    const files = readdirSync(FOLDER).filter((name) => /\.ya?ml$/.test(name));
    expect(files.sort()).toEqual(['audit.yml', 'ci.yml', 'docker.yml']);
    for (const name of files)
      expect(workflowProblems(name, readFileSync(`${FOLDER}${name}`, 'utf8'), STACK)).toEqual([]);
  });

  it('[SEC-007] an action named by tag, by branch or by a short commit is refused', () => {
    // Act
    const tag = ci(CHECKOUT, 'actions/checkout@v7');
    const exact = ci(CHECKOUT, 'actions/checkout@v7.0.1');
    const branch = ci(CHECKOUT, 'actions/checkout@main');
    const short = ci(CHECKOUT, 'actions/checkout@3d3c42e # v7.0.1');
    // Assert
    const problem = (ref) => `ci.yml: ${ref} is not pinned by commit (owner/repo@<40 hex digits>)`;
    expect(tag).toEqual([problem('actions/checkout@v7')]);
    expect(exact).toEqual([problem('actions/checkout@v7.0.1')]);
    expect(branch).toEqual([problem('actions/checkout@main')]);
    expect(short).toEqual([problem('actions/checkout@3d3c42e')]);
  });

  it('[SEC-007] a commit must carry the version it stands for', () => {
    // Arrange
    const commit = CHECKOUT.split(' ')[0];
    const problem = 'ci.yml: actions/checkout: name the version after the commit (# v1.2.3)';
    // Act and assert
    expect(ci(CHECKOUT, commit)).toEqual([problem]);
    expect(ci(CHECKOUT, `${commit} # v7`)).toEqual([problem]);
    expect(ci(CHECKOUT, `${commit} # the newest`)).toEqual([problem]);
    expect(ci(CHECKOUT, `"${commit}" # v7.0.1`)).toEqual([]);
  });

  it('[SEC-007] a service image needs a digest, the same one as the app stack names', () => {
    // Arrange
    const image = `redis:7-alpine@${STACK.get('redis:7-alpine')}`;
    const other = `redis:7-alpine@sha256:${'0'.repeat(64)}`;
    // Act
    const tag = ci(image, 'redis:7-alpine');
    const changed = ci(image, other);
    const unknown = ci(image, `valkey/valkey:9@sha256:${'0'.repeat(64)}`);
    // Assert
    expect(STACK.size).toBeGreaterThanOrEqual(4);
    expect(tag).toEqual(['ci.yml: image redis:7-alpine is not pinned by digest']);
    expect(changed).toEqual(['ci.yml: image redis:7-alpine has another digest than deploy/compose.app.yml']);
    expect(unknown).toEqual([]);
  });

  it('[SEC-007] a job container and a docker:// step need a digest too', () => {
    // Arrange
    const workflow = (container, uses) =>
      `permissions:\n  contents: read\njobs:\n  a:\n    container: ${container}\n    steps:\n      - uses: ${uses}\n`;
    const digest = `@sha256:${'a'.repeat(64)}`;
    // Act
    const loose = workflowProblems('x.yml', workflow('node:24', 'docker://alpine:3.22'));
    const exact = workflowProblems('x.yml', workflow(`node:24${digest}`, `docker://alpine:3.22${digest}`));
    const local = workflowProblems('x.yml', workflow(`node:24${digest}`, './.github/actions/setup'));
    // Assert
    expect(loose).toEqual([
      'x.yml: docker://alpine:3.22 is not pinned by digest',
      'x.yml: image node:24 is not pinned by digest',
    ]);
    expect([exact, local]).toEqual([[], []]);
  });

  it('[SEC-007] a token that may write, or no stated permissions, is refused', () => {
    // Arrange
    const stated = 'permissions:\n  contents: read\n';
    // Act
    const missing = ci(stated, '');
    const write = ci(stated, 'permissions:\n  contents: write\n  packages: read\n');
    const all = ci(stated, 'permissions: write-all\n');
    const job = ci(
      '    runs-on: ubuntu-24.04\n',
      '    runs-on: ubuntu-24.04\n    permissions:\n      id-token: write\n',
    );
    // Assert
    expect(missing).toEqual(['ci.yml: the workflow must set top-level permissions']);
    expect(write).toEqual(["ci.yml: workflow permission contents: write; a workflow's token only reads"]);
    expect(all).toEqual(["ci.yml: workflow permission all: write-all; a workflow's token only reads"]);
    expect(job).toEqual(["ci.yml: job permission id-token: write; a workflow's token only reads"]);
  });

  it('[SEC-007] a checkout that keeps the token on disk is refused', () => {
    // Act
    const kept = ci('        with:\n          persist-credentials: false\n', '');
    const on = ci('          persist-credentials: false\n', '          persist-credentials: true\n');
    // Assert
    const problem = 'ci.yml: the checkout step must set persist-credentials: false';
    expect(kept).toEqual([problem]);
    expect(on).toEqual([problem]);
  });
});
