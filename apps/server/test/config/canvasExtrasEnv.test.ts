/**
 * Unit tests for the two Canvas settings of S6 step 3: `AGS_LABEL_MODE`, which says how a graded placement names its
 * points formative (D-105), and `NRPS_MAX_PAGES`, the most roster pages the learner count reads (LTI-008).
 *
 * Spec: LTI-013, LTI-008
 */
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { AGS_LABEL_MODES, DEFAULT_AGS_LABEL_MODE } from '../../src/lti/deepLinking/formativeLabel.js';
import { envProblems, VALID_ENV } from '../support/authEnv.js';

describe('[LTI-013] AGS_LABEL_MODE and [LTI-008] NRPS_MAX_PAGES', () => {
  it('[LTI-013] the label mode is the spec as written, «(formativ)» in the name, unless HVL chooses otherwise (Q8)', () => {
    // Act
    const env = loadEnv(VALID_ENV);
    // Assert
    expect(env.AGS_LABEL_MODE).toBe('suffix');
    expect(DEFAULT_AGS_LABEL_MODE).toBe('suffix');
    expect(loadEnv({ ...VALID_ENV, AGS_LABEL_MODE: 'preserve' }).AGS_LABEL_MODE).toBe('preserve');
  });

  it('[LTI-013] a label mode outside D-105’s two is refused at start-up, by name', () => {
    expect(AGS_LABEL_MODES).toEqual(['suffix', 'preserve']);
    expect(envProblems({ ...VALID_ENV, AGS_LABEL_MODE: 'none' })[0]).toMatch(/^AGS_LABEL_MODE:/);
  });

  it('[LTI-008] the learner count reads up to 100 pages of 50 by default, and 1–1000 when set', () => {
    // Act
    const env = loadEnv(VALID_ENV);
    // Assert
    expect(env.NRPS_MAX_PAGES).toBe(100);
    expect(loadEnv({ ...VALID_ENV, NRPS_MAX_PAGES: '3' }).NRPS_MAX_PAGES).toBe(3);
    for (const value of ['0', '1001', '2.5', 'many']) {
      expect(envProblems({ ...VALID_ENV, NRPS_MAX_PAGES: value })[0]).toMatch(/^NRPS_MAX_PAGES:/);
    }
  });
});
