/**
 * reportGuards tests — the conformance report generator stops, writing nothing, wherever going on would leave a
 * criterion out, link a check to no test, name a protocol step that does not exist, show an HVL verdict without a
 * dated evaluation, or write a report whose manual blocks would not read back; and a file whose hook failed is
 * reported as failed, not as merely skipped.
 * Spec: UD-040
 */
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { composeReport, loadSources } from '../buildReport.mjs';
import { EVIDENCE, evidenceProblems } from '../criterionEvidence.mjs';
import { suiteCheck, testCheck } from '../evidenceShapes.mjs';
import { CRITERIA } from '../wcagCriteria.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const start = (id) => `<!-- manual:${'start'} ${id} -->`;
const end = (id) => `<!-- manual:${'end'} ${id} -->`;
const withBlock = (text, id, body) => {
  const from = text.indexOf(start(id)) + start(id).length;
  return text.slice(0, from) + body + text.slice(text.indexOf(end(id)));
};
// WHY: built at run time, so spec-trace's scan of the sources does not read it as a requirement that does not exist.
const UNKNOWN_ID = ['UD', '999'].join('-');
/** The sources with one criterion's evidence replaced. */
const withEvidence = (sources, id, entry) => ({ ...sources, evidence: { ...sources.evidence, [id]: entry } });

describe('[UD-040] the conformance report generator stops instead of overstating', () => {
  let sources;
  let fresh;
  beforeAll(async () => {
    sources = await loadSources(ROOT);
    fresh = composeReport(sources, undefined, '');
  });

  it('[UD-040] refuses an evidence map that misses a criterion, names an unknown one, or has a check without its parts', () => {
    // Arrange: the map without 2.5.8
    const missing = Object.fromEntries(Object.entries(EVIDENCE).filter(([id]) => id !== '2.5.8'));

    // Act and assert: each problem is named, and the composer refuses the map
    expect(evidenceProblems(missing)).toEqual(['criterion 2.5.8 has no entry in the evidence map']);
    expect(evidenceProblems({ ...EVIDENCE, '2.4.13': { checks: [], protocol: [] } })).toEqual([
      'the evidence map names 2.4.13, which is not a WCAG 2.2 A or AA criterion',
    ]);
    expect(
      evidenceProblems({ ...EVIDENCE, '1.2.4': { checks: [{ how: 'x', match: [] }], protocol: [] } }),
    ).toEqual(['a check of 1.2.4 needs the IDs it matches and what it checks']);
    expect(() => composeReport({ ...sources, evidence: missing }, undefined, fresh)).toThrow(
      /evidence map is incomplete/,
    );
    expect(CRITERIA.every((c) => EVIDENCE[c.id])).toBe(true);
  });

  it('[UD-040] stops on a check that matches no running test and on a protocol step the protocol does not have', () => {
    const stale = withEvidence(sources, '1.2.4', { checks: [testCheck([UNKNOWN_ID], 'gone')], protocol: [] });
    const staleSuite = withEvidence(sources, '1.2.4', {
      checks: [suiteCheck('keyboardFocus.a11y.test.ts', ['UD-004'], 'gone', 'x', 'no such title')],
      protocol: [],
    });
    const noStep = withEvidence(sources, '1.2.4', { checks: [], protocol: ['J9.9'] });

    // Act and assert
    expect(() => composeReport(stale, undefined, fresh)).toThrow(
      new RegExp(`criterion 1\\.2\\.4: no running test matches \\[${UNKNOWN_ID}\\]`),
    );
    expect(() => composeReport(staleSuite, undefined, fresh)).toThrow(/no running test matches \[UD-004\]/);
    expect(() => composeReport(noStep, undefined, fresh)).toThrow(/names "J9\.9", which .* does not have/);
  });

  it('[UD-040] stops on an HVL verdict in the report that no dated evaluation stands behind', () => {
    const undated = withBlock(
      fresh,
      'sc-1.4.3',
      '\n**Verdict:** Supports\n\n**Evaluated by HVL:** Not yet tested by HVL.\n',
    );
    const dated = withBlock(
      fresh,
      'sc-1.4.3',
      '\n**Verdict:** Supports\n\n**Evaluated by HVL:** 2027-01-15, ALU (KH).\n',
    );

    // Act and assert
    expect(() => composeReport(sources, undefined, undated)).toThrow(
      /sc-1\.4\.3.*Supports.*Evaluated by HVL/,
    );
    expect(composeReport(sources, undefined, dated)).toContain('| AA | Supports |');
  });

  it('[UD-040] refuses to return a report whose generated text would open or add a manual block', () => {
    const opens = withEvidence(sources, '1.2.4', { checks: [], protocol: [], note: start('scope') });
    const adds = withEvidence(sources, '1.2.4', {
      checks: [],
      protocol: [],
      note: `${start('sc-9.9.9')}${end('sc-9.9.9')}`,
    });

    expect(() => composeReport(opens, undefined, fresh)).toThrow(/appears twice|starts inside/);
    expect(() => composeReport(adds, undefined, fresh)).toThrow(/does not read back its manual blocks/);
  });

  it('[UD-040] says a file whose hook failed failed, in its checks, the header and the appendix', () => {
    const summary = {
      format: 2,
      command: 'npm run test:a11y',
      date: '2030-01-02',
      commit: 'c'.repeat(40),
      worktree: 'clean',
      axeCore: '4.13.0',
      totals: { files: 1, failedFiles: 1, passed: 0, failed: 0, skipped: 1 },
      failedFiles: ['targetSize.a11y.test.ts'],
      files: {
        'targetSize.a11y.test.ts': [
          {
            group: '',
            title: '[UD-005] / : every target of the page and its frames is 24 × 24 px or excepted',
            status: 'skipped',
          },
        ],
      },
      axe: { scans: 0, labels: [], blocking: [], other: [], review: [] },
    };

    // Act
    const report = composeReport(sources, summary, fresh);

    // Assert
    expect(report).toContain('Last run: its file failed (appendix A); 1 skipped.');
    expect(report).toContain('0 passed, 0 failed, 1 skipped; 1 of 1 files failed (appendix A)');
    expect(report).toContain('| failed | 0 | 0 | 1 |');
    expect(report).toContain('skipped or unlisted): `targetSize.a11y.test.ts`.');
  });
});
