/**
 * Content test for what the DPIA input says about who is recorded as a learner (D-138): a person from another Feide
 * organisation plays without a statement being stored (R37), and learners who cooperate with the reader of insight
 * remain a residual for the DPO (R41). The rule in code is pinned beside the words, so a change on either side fails
 * until both agree again, as ./dpiaEmployeeLearners.test.ts does for R40.
 *
 * Spec: DATA-005, INS-006
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { recordsLearningData } from '../../src/xapi/learningDataScope.js';

const DPIA = readFileSync(
  fileURLToPath(new URL('../../../../docs/privacy/DPIA-INPUT.md', import.meta.url)),
  'utf8',
);

/** The DPIA input's table row whose first cell is `id`; '' when there is none. */
const rowOf = (id: string): string => DPIA.split('\n').find((line) => line.startsWith(`| ${id} |`)) ?? '';

describe('[DATA-005] the DPIA input says who is recorded as a learner', () => {
  it('[DATA-005] R37: a learner from another Feide organisation stores no statement, and the row says what is kept', () => {
    // Arrange
    const guest = { roles: ['learner'], mode: 'portal', hvlMember: false } as const;
    const r37 = rowOf('R37');
    // Act and assert: the code, then the words
    expect(recordsLearningData(guest)).toBe(false);
    expect(recordsLearningData({ ...guest, hvlMember: true })).toBe(true);
    expect(r37).toContain('no statement of theirs is stored');
    expect(r37).toMatch(/Still stored about them: .*saved state/);
    expect(r37).not.toMatch(/stored and counted like an HVL student/);
  });

  it('[INS-006] R41: cooperating learners are named as a residual, with the options the DPO chooses between', () => {
    // Arrange
    const r41 = rowOf('R41');
    // Act
    const cells = r41.split('|').slice(1, -1);
    // Assert
    expect(cells).toHaveLength(6);
    expect(r41).toMatch(/Learners who cooperate with the reader of insight/);
    expect(r41).toMatch(/not compared with the course's roster/);
    expect(r41).toMatch(/Accept; or show a share only when right and wrong each number \*k\*/);
  });

  it('[DATA-005] R4 records that the owner kept the share rule, and the DPO is asked about every residual', () => {
    // Arrange: the table's last residual, so a residual added later needs no change here
    const last = Math.max(...[...DPIA.matchAll(/^\| R(\d+) \|/gm)].map((row) => Number(row[1])));
    // Act
    const r4 = rowOf('R4');
    // Assert
    expect(r4).toContain('kept by the owner on 2026-11-22 (D-138)');
    expect(last).toBeGreaterThanOrEqual(43);
    expect(DPIA).toContain(`For each residual R1–R${last}`);
  });
});
