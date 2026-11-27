/**
 * Tests that CI runs the dependency gates (SEC-007): it installs from the lock file, checks the lock file before
 * anything is installed, checks pins, workflow pins and advisories, a daily run checks the advisories on the
 * default branch, and Dependabot proposes grouped monthly updates.
 *
 * Spec: SEC-007
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const ci = readFileSync(`${root}.github/workflows/ci.yml`, 'utf8');
const runLines = [...ci.matchAll(/^\s+run: (.+)$/gm)].map((m) => m[1]);
const runs = (command) => runLines.some((line) => line.includes(command));

describe('[SEC-007] dependency hygiene in CI', () => {
  it('[SEC-007] installs from the lockfile and checks pins and the audit', () => {
    expect(runs('npm ci')).toBe(true);
    expect(runs('npm run check:pins')).toBe(true);
    expect(runs('npm run check:audit')).toBe(true);
  });

  it('[SEC-007] checks the lock file before anything is installed, and the pins of the workflows themselves', () => {
    const at = (command) => runLines.findIndex((line) => line.includes(command));
    expect(at('node tools/dependency-check/checkLockfile.mjs')).toBeGreaterThanOrEqual(0);
    expect(at('node tools/dependency-check/checkLockfile.mjs')).toBeLessThan(at('npm ci'));
    expect(runs('npm run check:workflows')).toBe(true);
  });

  it('[SEC-007] a daily run checks the lock file and the advisories without installing anything', () => {
    const audit = readFileSync(`${root}.github/workflows/audit.yml`, 'utf8');
    const commands = [...audit.matchAll(/^\s+run: (.+)$/gm)].map((m) => m[1]);
    expect(audit).toMatch(/\n {2}schedule:\n(\s+#.*\n)*\s+- cron: '\d+ \d+ \* \* \*'\n/);
    expect(commands).toEqual(['node tools/dependency-check/checkLockfile.mjs', 'npm run check:audit']);
  });

  it('[SEC-007] Dependabot groups its monthly pull requests per ecosystem and never proposes a major version', () => {
    const dependabot = readFileSync(`${root}.github/dependabot.yml`, 'utf8');
    for (const ecosystem of ['npm', 'github-actions', 'docker']) {
      const block = dependabot.split(`package-ecosystem: ${ecosystem}`)[1].split('package-ecosystem:')[0];
      expect(block).toMatch(/interval: monthly/);
      expect(block).toMatch(/update-types: \[minor, patch\]/);
      expect(block).toMatch(/update-types: \['version-update:semver-major'\]/);
    }
  });

  it('[SEC-007] Playwright comes as a pull request of its own, and no other Ubuntu version is proposed (D-148)', () => {
    // Act: read the committed settings, one block per ecosystem
    const dependabot = readFileSync(`${root}.github/dependabot.yml`, 'utf8');
    const block = (ecosystem) =>
      dependabot.split(`package-ecosystem: ${ecosystem}`)[1].split('package-ecosystem:')[0];
    // Assert
    // WHY: a dependency joins the first group it fits, so Playwright's group stands before the general one.
    expect(block('npm')).toMatch(
      /groups:\n(\s+#.*\n)*\s+playwright:\n\s+patterns: \['playwright-core'\]\n[\s\S]*minor-and-patch:\n\s+exclude-patterns: \['playwright-core'\]/,
    );
    expect(block('npm')).toMatch(/open-pull-requests-limit: 3/);
    expect(block('docker')).toMatch(
      /- dependency-name: 'ubuntu'\n\s+update-types: \['version-update:semver-minor'\]/,
    );
  });
});
