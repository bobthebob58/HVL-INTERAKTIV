/**
 * Tests that CI runs every maintainability and dependency gate the specs require.
 *
 * Spec: NFR-004, SEC-007, NFR-005
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const ci = readFileSync(`${root}.github/workflows/ci.yml`, 'utf8');
const runLines = [...ci.matchAll(/^\s+run: (.+)$/gm)].map((m) => m[1]);
const scripts = JSON.parse(readFileSync(`${root}package.json`, 'utf8')).scripts;
const runs = (command) => runLines.some((line) => line.includes(command));

describe('[NFR-004] CI runs the maintainability gates', () => {
  it('[NFR-004] runs typecheck, lint, formatting, tests, file size and the documentation linter', () => {
    for (const script of ['typecheck', 'lint', 'format:check', 'check:filesize', 'doc:lint']) {
      expect(runs(`npm run ${script}`), script).toBe(true);
    }
    expect(runs('npm test')).toBe(true);
  });

  it('[NFR-004] runs the traceability check for every finished session', () => {
    expect(runs('npm run spec:trace -- --check --done-through=S1')).toBe(true);
    expect(runs('npm run spec:site -- --check')).toBe(true);
  });

  it('[NFR-004] every npm script CI calls exists', () => {
    const scriptsOf = (workspace) =>
      workspace ? JSON.parse(readFileSync(`${root}${workspace}/package.json`, 'utf8')).scripts : scripts;
    for (const line of runLines) {
      for (const m of line.matchAll(/npm run ([\w:-]+)(?: -- [^&]*)?(?: --workspace (\S+))?/g)) {
        expect(scriptsOf(m[2])[m[1]], `${m[1]} ${m[2] ?? ''}`).toBeDefined();
      }
    }
  });

  it('[NFR-004] runs integration tests against real services and never skips them', () => {
    for (const service of ['postgres:16-alpine', 'redis:7-alpine', 'motoserver/moto'])
      expect(ci).toContain(service);
    expect(ci).toMatch(/CI: 'true'/);
  });
});

describe('[SEC-007] dependency hygiene in CI', () => {
  it('[SEC-007] installs from the lockfile and checks pins and the audit', () => {
    expect(runs('npm ci')).toBe(true);
    expect(runs('npm run check:pins')).toBe(true);
    expect(runs('npm run check:audit')).toBe(true);
  });

  it('[SEC-007] Dependabot opens weekly update pull requests', () => {
    const dependabot = readFileSync(`${root}.github/dependabot.yml`, 'utf8');
    expect(dependabot).toMatch(/package-ecosystem: npm[\s\S]*interval: weekly/);
  });
});

describe('[NFR-005] licence check in CI', () => {
  it('[NFR-005] checks production dependency licences', () => {
    expect(runs('npm run check:licences')).toBe(true);
  });
});
