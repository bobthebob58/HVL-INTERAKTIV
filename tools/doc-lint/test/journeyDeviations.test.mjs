/**
 * Tests that the journeys of spec 00 §3 which S6 tests only in part are decided where their tests and code point:
 * J1 is split because the picker lacks the content bank and «Create new» from a pattern, and J5's staging-to-production
 * promotion is an operations procedure. D-101 promised an amendment for each; its amendment of 2026-11-05 (S6 step 8)
 * holds them, the J1 test, the picker's code and spec 02's code map cite it, and the runbook holds the procedure the J5
 * test cites. A `SPEC-DEVIATION: D-101` whose decision only promises the amendment passes the deviations check, so
 * these read the records themselves. The Evaluator Guide's `npm run test:e2e` row, where an evaluator looks up which
 * flow proves a requirement, names every end-to-end test file and does not promise the journeys whole.
 *
 * Spec: DOC-010, DOC-004
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const server = (path) => join(root, 'apps/server', path);

/**
 * D-101's amendment for the journey tests, from its bullet to the next top-level bullet, on one line (its wrapping
 * does not matter); '' when there is none.
 */
function journeyAmendment() {
  const decisions = read('docs/DECISIONS.md');
  const d101 = decisions.slice(decisions.indexOf('### D-101 '), decisions.indexOf('### D-102 '));
  const start = d101.indexOf('- **Amendment (2026-11-05, S6 step 8');
  if (start < 0) return '';
  const end = d101.indexOf('\n- **', start + 1);
  return (end < 0 ? d101.slice(start) : d101.slice(start, end)).replace(/\s+/g, ' ');
}

/** The row of spec 02 §8's code map for one requirement. */
const codeMapRow = (id) =>
  read('docs/specs/02-auth-feide-lti13.md')
    .split('\n')
    .find((line) => line.startsWith(`| \`${id}\` |`)) ?? '';

describe('[DOC-010] the journeys S6 tests in part are decided where they are traced', () => {
  it('[DOC-010] D-101 records J1’s split, and the tests of both halves it names exist', () => {
    // Arrange
    const halves = [
      'e2e/patternToPublish.e2e.test.ts',
      'e2e/publishWithReason.e2e.test.ts',
      'e2e/journeyPlaceInCanvas.e2e.test.ts',
    ];
    // Act
    const amendment = journeyAmendment();
    // Assert
    expect(amendment).toContain('**J1 is split** (`SPEC-DEVIATION`');
    expect(amendment).toContain('docs/handoff/canvas-studio.md');
    for (const file of halves) {
      expect(amendment).toContain(file);
      expect(existsSync(server(file)), file).toBe(true);
    }
    // Assert: the MUSTs whose Verify line asks for "e2e for J1" say so where a reader traces them
    const block = (path, id, next) => {
      const text = read(path);
      return text.slice(text.indexOf(`#### ${id} `), text.indexOf(`#### ${next} `));
    };
    for (const verify of [
      block('docs/specs/00-product-and-pedagogy.md', 'PROD-001', 'PROD-002'),
      block('docs/specs/02-auth-feide-lti13.md', 'LTI-005', 'LTI-006'),
    ])
      expect(verify).toMatch(/\*\*Amended \(D-101, 2026-11-05, S6 step 8\):\*\* `SPEC-DEVIATION`/);
  });

  it('[DOC-010] the J1 test cites that amendment, and the picker’s code marks what it lacks', () => {
    // Act
    const test = read('apps/server/e2e/journeyPlaceInCanvas.e2e.test.ts');
    const picker = ['deepLinkActivities.ts', 'deepLinkRoutes.ts'].map((file) =>
      read(`apps/server/src/lti/deepLinking/${file}`),
    );
    // Assert
    expect(test).toContain('SPEC-DEVIATION: D-101 (amendment of 2026-11-05, S6 step 8)');
    for (const code of picker) expect(code).toMatch(/SPEC-DEVIATION: D-101\b.*content bank/);
  });

  it('[DOC-010] spec 02’s code map says LTI-005’s and LTI-007’s Canvas parts pass to the students, not to S6', () => {
    // Act
    const rows = ['LTI-005', 'LTI-007'].map(codeMapRow);
    // Assert
    for (const row of rows) {
      expect(row).toContain('`SPEC-DEVIATION` D-101');
      expect(row).toContain('`docs/handoff/canvas-studio.md`');
      expect(row).not.toMatch(/comes? in S6/);
    }
  });

  it('[DOC-010] D-101 records J5’s coverage, and the runbook holds the promotion the J5 test cites', () => {
    // Arrange
    const tests = [
      'e2e/journeyGovernance.e2e.test.ts',
      'test/http/packageImport.int.test.ts',
      'test/http/ajax.int.test.ts',
    ];
    // Act
    const amendment = journeyAmendment();
    const runbook = read('docs/ops/runbook.md');
    const startAndStop = runbook.slice(runbook.indexOf('## 2. '), runbook.indexOf('## 3. '));
    const test = read('apps/server/e2e/journeyGovernance.e2e.test.ts');
    // Assert
    for (const file of tests) {
      expect(amendment).toContain(file);
      expect(existsSync(server(file)), file).toBe(true);
    }
    expect(amendment).toContain('*A new content-type version* in `docs/ops/runbook.md` §2');
    expect(startAndStop).toMatch(
      /\*\*A new content-type version\*\*[^]*\*\*Staging:\*\*[^]*\*\*Production:\*\*/,
    );
    expect(test).toContain('«A new content-type version» in docs/ops/runbook.md §2');
  });
});

describe('[DOC-004] the Evaluator Guide says which end-to-end flow proves what', () => {
  it('[DOC-004] the `npm run test:e2e` row names every e2e test file and promises no whole J1–J5', () => {
    // Arrange
    const files = readdirSync(server('e2e')).filter((name) => name.endsWith('.e2e.test.ts'));
    // Act
    const row =
      read('docs/EVALUATOR-GUIDE.md')
        .split('\n')
        .find((line) => line.startsWith('| `npm run test:e2e`')) ?? '';
    // Assert
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(row, file).toContain(`\`${file}\``);
    expect(row).not.toMatch(/Canvas side included/);
  });
});
