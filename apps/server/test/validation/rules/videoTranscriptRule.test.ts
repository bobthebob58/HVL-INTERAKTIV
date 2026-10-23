/**
 * Tests for V-VID-TRANSCRIPT (videoTranscriptRule): videos need a transcript or text alternative. Each fixture in apps/server/test/fixtures/content/V-VID-TRANSCRIPT/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { videoTranscriptRule } from '../../../src/validation/rules/videoTranscriptRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-VID-TRANSCRIPT', () => {
  it.each(fixturesOf('V-VID-TRANSCRIPT'))('[UD-021][V-VID-TRANSCRIPT] $name: $description', (fixture) => {
    expect(hitsOf(videoTranscriptRule, fixture)).toEqual(fixture.expected);
  });
});
