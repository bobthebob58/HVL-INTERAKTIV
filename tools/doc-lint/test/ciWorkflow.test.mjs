/**
 * Tests that CI runs every maintainability and dependency gate the specs require, with time for them, and that its
 * traceability check covers every session PROGRESS.md marks done.
 *
 * Spec: NFR-004, SEC-007, NFR-005, PED-001, DOC-004
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const ci = readFileSync(`${root}.github/workflows/ci.yml`, 'utf8');
const runLines = [...ci.matchAll(/^\s+run: (.+)$/gm)].map((m) => m[1]);
const scripts = JSON.parse(readFileSync(`${root}package.json`, 'utf8')).scripts;
const runs = (command) => runLines.some((line) => line.includes(command));

/** Cells of a Markdown table row, trimmed and without bold or italic marks; `\|` does not split a cell. */
const cellsOf = (line) =>
  line
    .trim()
    .replace(/^\||(?<!\\)\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/^[*_]+|[*_]+$/g, ''));

/**
 * The highest session number that PROGRESS.md's status table marks done (✅), or undefined when none is.
 * WHY: the first table whose header has `Session` and `Status` columns (wherever they are) is read up to its last
 * row, and only `S<n>` rows count, so another column, a sub-pass row such as `S4+`, bold, a longer status text or
 * a later table cannot shift the answer.
 */
function lastDoneSession(progress) {
  const lines = progress.split('\n');
  const isRow = (line) => line.trim().startsWith('|');
  const at = lines.findIndex(
    (line) => isRow(line) && ['Session', 'Status'].every((h) => cellsOf(line).includes(h)),
  );
  if (at < 0) return undefined;
  const [session, status] = ['Session', 'Status'].map((h) => cellsOf(lines[at]).indexOf(h));
  const end = lines.findIndex((line, i) => i > at && !isRow(line));
  const done = lines
    .slice(at + 1, end < 0 ? undefined : end)
    .map(cellsOf)
    .filter((cells) => /^S\d+$/.test(cells[session] ?? '') && (cells[status] ?? '').startsWith('✅'))
    .map((cells) => Number(cells[session].slice(1)));
  return done.length > 0 ? Math.max(...done) : undefined;
}

describe('[NFR-004] CI runs the maintainability gates', () => {
  it('[NFR-004] runs typecheck, lint, formatting, tests, file size and the documentation linter', () => {
    for (const script of ['typecheck', 'lint', 'format:check', 'check:filesize', 'doc:lint']) {
      expect(runs(`npm run ${script}`), script).toBe(true);
    }
    expect(runs('npm test')).toBe(true);
  });

  it('[NFR-004] runs the traceability check for every finished session', () => {
    expect(runs('npm run spec:trace -- --check --done-through=S')).toBe(true);
    expect(runs('npm run spec:site -- --check')).toBe(true);
  });

  it('[NFR-004] builds the API documentation with warnings as errors', () => {
    expect(runs('npm run docs:api')).toBe(true);
    const typedoc = JSON.parse(readFileSync(`${root}apps/server/typedoc.json`, 'utf8'));
    expect(typedoc.treatWarningsAsErrors).toBe(true);
  });

  it('[LTI-003] runs the end-to-end flows in full Chromium (the headless shell ignores cookie blocking, D-065)', () => {
    expect(runs('npm run test:e2e')).toBe(true);
    expect(runs('--only-shell')).toBe(false);
  });

  it('[H5P-003] never contacts the H5P Hub and installs the browser for the SVG rendering test', () => {
    expect(ci).not.toMatch(/hub:check|fetch-seed-packages|hub-api\.h5p\.org/);
    expect(runs('playwright-core install --with-deps chromium')).toBe(true);
  });

  it('[PED-001] checks the studio content after the H5P libraries are fetched (D-082, D-084)', () => {
    const fetched = runLines.findIndex((line) => line.includes('npm run h5p:fetch-libraries'));
    const checked = runLines.findIndex((line) => line.includes('npm run content:check'));
    expect(checked).toBeGreaterThan(fetched);
    expect(fetched).toBeGreaterThanOrEqual(0);
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

  it('[NFR-004] gives the job time for the S4 steps and caches the H5P library checkouts', () => {
    // WHY: the job runs the a11y suite and builds ten content types; 30 minutes cut it off (final review F3, DOC-10).
    expect(Number(/^\s+timeout-minutes: (\d+)$/m.exec(ci)?.[1])).toBeGreaterThanOrEqual(60);
    expect(ci).toMatch(
      /uses: actions\/cache@v\d+\n\s+with:\n\s+path: ~\/\.cache\/hvl-interaktiv\/h5p-libraries\n/,
    );
  });

  it('[NFR-004] runs integration tests against real services and never skips them', () => {
    for (const service of ['postgres:16-alpine', 'redis:7-alpine', 'motoserver/moto'])
      expect(ci).toContain(service);
    expect(ci).toMatch(/CI: 'true'/);
  });
});

describe('[DOC-004] CI requires tests for every finished session', () => {
  it('[DOC-004] requires tests up to the last session PROGRESS.md marks done, so CI cannot go stale', () => {
    // Arrange: every --done-through in CI's commands, and PROGRESS.md's status table.
    const doneThrough = runLines.flatMap((line) =>
      [...line.matchAll(/spec:trace -- --check --done-through=S(\d+)\b/g)].map((m) => Number(m[1])),
    );
    const last = lastDoneSession(readFileSync(`${root}PROGRESS.md`, 'utf8'));
    // Act and assert: one traceability step, raised in the same change that marks a session ✅.
    expect(last, 'no S<n> row of the PROGRESS.md status table is marked ✅').toBeTypeOf('number');
    expect(doneThrough).toEqual([last]);
  });

  it('[DOC-004] reads the status table by its header, ignoring sub-pass rows and unfinished sessions', () => {
    // Arrange: columns in another order, an extra column, a sub-pass row, bold, an escaped pipe, open sessions.
    const progress = [
      '# PROGRESS',
      '| Kind | Status | Session |',
      '|---|---|---|',
      '| a | ✅ Done (2026-10-16) | S0 |',
      '| b | **✅ Gate passed**; `-t "A\\|B"` open | **S1** |',
      '| c | ✅ Done: a simplification pass | S1+ |',
      '| d | 🟨 In progress | S2 |',
      '| e | ⬜ Not started | S3 |',
      '',
      'Legend: ✅ done',
      '| Session | Status |',
      '|---|---|',
      '| S9 | ✅ another table |',
    ].join('\n');
    // Act and assert
    expect(lastDoneSession(progress)).toBe(1);
    expect(lastDoneSession('| Session | Status |\n|---|---|\n| S0 | ⬜ Not started |\n')).toBeUndefined();
    expect(lastDoneSession('no table here')).toBeUndefined();
  });
});

describe('[SEC-007] dependency hygiene in CI', () => {
  it('[SEC-007] installs from the lockfile and checks pins and the audit', () => {
    expect(runs('npm ci')).toBe(true);
    expect(runs('npm run check:pins')).toBe(true);
    expect(runs('npm run check:audit')).toBe(true);
  });

  it('[SEC-007] Dependabot opens one grouped monthly pull request per ecosystem and never a major version', () => {
    const dependabot = readFileSync(`${root}.github/dependabot.yml`, 'utf8');
    for (const ecosystem of ['npm', 'github-actions']) {
      const block = dependabot.split(`package-ecosystem: ${ecosystem}`)[1].split('package-ecosystem:')[0];
      expect(block).toMatch(/interval: monthly/);
      expect(block).toMatch(/update-types: \[minor, patch\]/);
      expect(block).toMatch(/update-types: \['version-update:semver-major'\]/);
    }
  });
});

describe('[NFR-005] licence check in CI', () => {
  it('[NFR-005] checks production dependency licences', () => {
    expect(runs('npm run check:licences')).toBe(true);
  });
});
