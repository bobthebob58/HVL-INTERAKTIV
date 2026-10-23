/**
 * Tests for PED-H03 (videoSummaryHint): end a video with a summary. Each fixture in apps/server/test/fixtures/content/PED-H03/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { videoSummaryHint } from '../../../src/validation/rules/videoSummaryHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H03', () => {
  it.each(fixturesOf('PED-H03'))('[PED-020][PED-H03] $name: $description', (fixture) => {
    expect(hitsOf(videoSummaryHint, fixture)).toEqual(fixture.expected);
  });
});
