/**
 * Tests for the check that holds the brief for the DPO's first meeting to the DPIA input's residual table (D-113):
 * the real brief names each residual once, and each way the two can drift apart is named.
 *
 * Spec: DATA-005
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dpiaProblems, readDpiaDocs } from '../checkDpiaInput.mjs';
import { dpoBriefProblems, residualsNamed } from '../dpoBriefProblems.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const real = () => readDpiaDocs(ROOT);
const lastOf = (dpia) => Math.max(...[...dpia.matchAll(/^\| R(\d+) \|/gm)].map((m) => Number(m[1])));

describe('[DATA-005] the brief for the DPO names every residual of the DPIA input once', () => {
  it('[DATA-005] the real brief sorts every residual of §12 into one theme', () => {
    // Arrange
    const { dpia, brief } = real();
    // Act
    const problems = dpoBriefProblems(lastOf(dpia), brief);
    // Assert
    expect(problems).toEqual([]);
  });

  it('[DATA-005] a residual added to the DPIA input but not to the brief fails the DPIA check', () => {
    // Arrange: one row after the last, as a later step would add it
    const docs = real();
    const last = lastOf(docs.dpia);
    const lastRow = docs.dpia.split('\n').find((line) => line.startsWith(`| R${last} |`));
    docs.dpia = docs.dpia
      .replace(lastRow, `${lastRow}\n| R${last + 1} | A new residual | m | r | o | x |`)
      .replaceAll(`R1–R${last}`, `R1–R${last + 1}`);
    // Act
    const problems = dpiaProblems(docs);
    // Assert
    expect(problems).toEqual([
      `DPO brief §3: R${last + 1} is in no theme`,
      `DPO brief §3: the last row must read **All**, **${last + 1}** and R1–R${last + 1}`,
    ]);
  });

  it('[DATA-005] a residual in two themes, a wrong count and a residual §12 does not list are caught', () => {
    // Arrange: R5 is moved into the first theme's row as well, whose count is left as it was
    const { dpia, brief } = real();
    const changed = brief.replace(/^(\| [^|]+ \| \d+ \| R1–R4,)/m, '$1 R5,') + '\nSee R999.\n';
    // Act
    const problems = dpoBriefProblems(lastOf(dpia), changed);
    // Assert
    expect(problems).toEqual([
      expect.stringMatching(/^DPO brief §3: «.+» says 12 but names 13$/),
      'DPO brief §3: R5 is in 2 themes',
      'DPO brief cites R999, which DPIA-INPUT.md §12 does not list',
    ]);
  });

  it('[DATA-005] a brief without its theme table is caught, residual by residual', () => {
    // Act
    const problems = dpoBriefProblems(2, '# Brief\n\n## 3. The residuals by theme\n\nNone yet.\n');
    // Assert
    expect(problems).toEqual([
      'DPO brief §3: R1 is in no theme',
      'DPO brief §3: R2 is in no theme',
      'DPO brief §3: the last row must read **All**, **2** and R1–R2',
    ]);
  });

  it('[DATA-005] a range is written out, with a hyphen or a dash, and a mistyped range stays bounded', () => {
    // Act
    const named = residualsNamed('R1–R3, R7, R9-R10');
    const mistyped = residualsNamed('R1–R4300000000');
    // Assert
    expect(named).toEqual([1, 2, 3, 9, 10, 7]);
    expect(mistyped).toHaveLength(1000);
  });
});
