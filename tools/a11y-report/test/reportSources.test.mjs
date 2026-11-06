/**
 * reportSources tests — the conformance report's sources are read from where they live: axe-core's own rule tags,
 * the manual protocol's steps and page checks, the register's links, and the test titles of the repository.
 * Spec: UD-040, UD-030, UD-031
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { axeRuleIndex, criteriaOfTags, rulesOfCriterion, suiteTags } from '../axeRuleIndex.mjs';
import { loadProtocol, protocolText, readProtocol } from '../protocolIndex.mjs';
import { openingIds, testsOfCheck, titleMatches, indexTests } from '../testIndex.mjs';
import { issueText, readRegister, upstreamLinks } from '../upstreamEntries.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** A throw-away repository root holding only the given files. */
function fakeRoot(dirs, files) {
  const root = mkdtempSync(join(tmpdir(), 'a11y-report-root-'));
  dirs.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('[UD-040] the sources of the conformance report', () => {
  let axe;
  const dirs = [];
  beforeAll(() => {
    axe = axeRuleIndex(ROOT);
  });
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('[UD-040] takes the suite’s tags from axeScan.ts and the rules from the axe-core the suite injects', () => {
    expect(suiteTags(ROOT)).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
    expect(criteriaOfTags(['cat.color', 'wcag2aa', 'wcag143', 'wcag1410', 'wcag2411'])).toEqual([
      '1.4.3',
      '1.4.10',
      '2.4.11',
    ]);
    expect(rulesOfCriterion(axe, '1.4.3').running.map((r) => r.id)).toEqual(['color-contrast']);
    expect(axe.rules.find((r) => r.id === 'color-contrast').helpUrl).not.toContain('?');
  });

  it('[UD-040] counts a rule as run exactly when axe runs it for those tags, as axe itself decides', () => {
    // WHY: target-size is off by default, yet a tag run includes it; experimental and deprecated rules stay out.
    expect(rulesOfCriterion(axe, '2.5.8').running.map((r) => r.id)).toContain('target-size');
    const parsing = rulesOfCriterion(axe, '4.1.1');
    expect(parsing.running).toEqual([]);
    expect(parsing.notRunning.map((r) => `${r.id} ${r.keptOutBy}`)).toContain('duplicate-id deprecated');
    expect(rulesOfCriterion(axe, '2.5.3').notRunning.map((r) => r.keptOutBy)).toEqual(['experimental']);
  });

  it('[UD-040] reads the protocol’s steps with their action and the page checks with their criteria', () => {
    const protocol = loadProtocol(ROOT);

    expect(protocol.steps.get('J2.3')).toMatch(/Sjekk/);
    expect(protocol.checks.find((c) => c.name === 'Skip link').criteria).toEqual(['2.4.1']);
    expect(protocol.checks.find((c) => c.name === '400 % zoom (Z400)').criteria).toEqual(['1.4.4', '1.4.10']);
    expect(protocolText(protocol, '§7 Reduced motion')).toBe('Reduced motion');
    expect(() => protocolText(protocol, 'J9.9')).toThrow(/does not have/);
    expect(() => protocolText(protocol, '§7 Sound')).toThrow(/does not have/);
  });

  it('[UD-040] finds a page check only under the protocol’s §7', () => {
    const text =
      '## 6. Tasks\n\n| Check | x | 1.1.1 |\n\n## 7. Checks\n\n| Check | Expected | Criterion |\n|---|---|---|\n| A | b | 2.4.1, `UD-006` |\n\n## 8. More\n';

    expect(readProtocol(text).checks).toEqual([{ name: 'A', criteria: ['2.4.1'] }]);
  });

  it('[UD-040] gives each register entry the source and issue links of the comment above it', async () => {
    // Act
    const register = await readRegister(ROOT);

    // Assert
    expect(register.findings.map((f) => f.ruleId)).toEqual(['color-contrast', 'nested-interactive']);
    expect(register.findings[0].source).toMatch(
      /^https:\/\/github\.com\/h5p\/h5p-editor-branching-scenario\//,
    );
    expect(register.englishTexts.map((t) => t.library)).toEqual([
      'H5P.Video 1.6',
      'H5P.ImageHotspots 1.11',
      'H5P.InteractiveVideo 1.28',
    ]);
    expect(issueText(register.findings[0])).toBe('not filed yet (D-112)');
    const [filed] = upstreamLinks(
      '  // UPSTREAM: https://github.com/h5p/x/tree/abc (1.0). Issue: https://github.com/h5p/x/issues/12.',
    );
    expect(filed).toEqual({
      source: 'https://github.com/h5p/x/tree/abc',
      issues: ['https://github.com/h5p/x/issues/12'],
    });
  });

  it('[UD-040] matches a test title by every ID that opens it, validator rule IDs included, and by its text', () => {
    // Act and assert: the IDs that open a title, then whole titles against checks
    expect(openingIds('[UD-021][V-IMG-ALT] treats «%s» as a file name')).toEqual(['UD-021', 'V-IMG-ALT']);
    expect(openingIds('the [UD-021] rule')).toEqual([]);
    const check = { match: ['UD-021', 'V-IMG-ALT'], how: 'x' };
    expect(titleMatches('[UD-021][V-IMG-ALT] treats «%s» as a file name', check)).toBe(true);
    expect(titleMatches('[UD-021][V-IMG-ALT-LENGTH] $name', check)).toBe(false);
    expect(
      titleMatches('[UD-006] the skip link appears', {
        match: ['UD-006'],
        contains: ['dialog', 'skip link'],
      }),
    ).toBe(true);
    expect(titleMatches('[UD-006] the tabs', { match: ['UD-006'], contains: ['dialog', 'skip link'] })).toBe(
      false,
    );
  });

  it('[UD-040] links a suite check only to its own suite file, and any other check never to the suite', () => {
    const index = indexTests(ROOT);

    // Act
    const suite = testsOfCheck(index, {
      suite: 'keyboardFocus.a11y.test.ts',
      match: ['UD-006'],
      contains: 'skip link',
    });
    const other = testsOfCheck(index, { match: ['UD-006'], contains: 'skip link' });

    // Assert
    expect(suite.map((f) => f.file)).toEqual(['apps/server/a11y/keyboardFocus.a11y.test.ts']);
    expect(other.length).toBeGreaterThan(0);
    expect(other.every((f) => !f.file.startsWith('apps/server/a11y/'))).toBe(true);
  });

  it('[UD-040] stops when the scanner no longer declares its tags, rather than say what axe runs', () => {
    const root = fakeRoot(dirs, { 'apps/server/a11y/support/axeScan.ts': 'export const TAGS = [];\n' });

    expect(() => suiteTags(root)).toThrow(/declares no WCAG_TAGS/);
  });

  it('[UD-040] stops when the register’s entries and upstream comments do not pair, rather than mislink an entry', async () => {
    const entry = "  { ruleId: 'color-contrast', surfaces: ['editor'], types: ['*'], why: 'x' },\n";
    const register =
      'export const UPSTREAM_FINDINGS = [\n  // UPSTREAM: https://github.com/h5p/a/tree/1\n' +
      `${entry}${entry}];\nexport const UPSTREAM_ENGLISH_TEXTS = [];\n`;
    const root = fakeRoot(dirs, { 'apps/server/a11y/support/upstreamRegister.ts': register });

    await expect(readRegister(root)).rejects.toThrow(
      /UPSTREAM_FINDINGS has 2 entries but 1 UPSTREAM: comments/,
    );
  });

  it('[UD-040] indexes only running test titles, so a skipped test is never linked as evidence', () => {
    const test =
      "import { it } from 'vitest';\nit('[UD-006] runs', () => {});\nit.skip('[UD-006] skipped', () => {});\n" +
      "it.todo('[UD-006] later');\n";
    const root = fakeRoot(dirs, { 'apps/web/test/x.test.ts': test });

    expect(indexTests(root)).toEqual([{ file: 'apps/web/test/x.test.ts', titles: ['[UD-006] runs'] }]);
  });
});
