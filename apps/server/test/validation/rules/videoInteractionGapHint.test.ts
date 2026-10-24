/**
 * Tests for PED-H02 (videoInteractionGapHint): add a check every few minutes. Each fixture in apps/server/test/fixtures/content/PED-H02/ is a whole
 * activity with exactly the hits it must give. Also checks how PED-H01 and PED-H02 show minutes in their messages.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import {
  videoInteractionGapHint,
  longestGap,
} from '../../../src/validation/rules/videoInteractionGapHint.js';
import { validateContent } from '../../../src/validation/validateContent.js';
import { minutesShown } from '../../../src/validation/videoTimeline.js';
import { TEST_CONTEXT, fixturesOf, hitsOf } from '../support/ruleFixtures.js';

/** An InteractiveVideo with a MultiChoice at each task time and a bookmark at the end. */
const videoWithTasks = (tasks: readonly number[], end: number) => ({
  mainLibrary: 'H5P.InteractiveVideo 1.28',
  metadata: { title: 'Video', defaultLanguage: 'nn' },
  params: {
    interactiveVideo: {
      video: { files: [{ path: 'videos/clip.webm', mime: 'video/webm' }] },
      assets: {
        interactions: tasks.map((from) => ({
          duration: { from, to: from },
          action: { library: 'H5P.MultiChoice 1.16', params: { question: '<p>Kva?</p>' } },
        })),
        bookmarks: [{ time: end, label: 'Slutt' }],
      },
    },
  },
});

const messagesOf = (
  input: ReturnType<typeof videoWithTasks>,
  locale: 'nn' | 'en',
  ruleId: string,
): string[] =>
  validateContent({ ...input, locale }, TEST_CONTEXT)
    .filter((finding) => finding.ruleId === ruleId)
    .map((finding) => finding.message);

describe('PED-H02', () => {
  it.each(fixturesOf('PED-H02'))('[PED-020][PED-H02] $name: $description', (fixture) => {
    expect(hitsOf(videoInteractionGapHint, fixture)).toEqual(fixture.expected);
  });

  it.each([
    [[60, 420], 430, 360],
    [[], 600, 600],
    [[120, 300, 480], 600, 180],
    [[300], 0, 300],
  ])(
    '[PED-020][PED-H02] finds the longest gap for tasks at %j with a known end of %d s',
    (tasks, end, gap) => {
      expect(longestGap(tasks, end)).toBe(gap);
    },
  );

  it.each([
    [241, 4.1],
    [282, 4.7],
    [689, 11.5],
    [901, 15.1],
  ])('[PED-020][PED-H02] shows %s seconds as %s minutes, rounded up', (seconds, minutes) => {
    expect(minutesShown(seconds)).toBe(minutes);
  });

  it('[PED-020][PED-H02] never shows a gap at or below the threshold that triggered it, in the locale’s format', () => {
    // Act: gaps of 241 s (4.02 min) and of 689 s (11.48 min)
    const justOver = messagesOf(videoWithTasks([0, 241, 482], 723), 'nn', 'PED-H02');
    const long = messagesOf(videoWithTasks([0, 241], 930), 'nn', 'PED-H02');
    const english = messagesOf(videoWithTasks([0, 241], 930), 'en', 'PED-H02');
    // Assert
    expect(justOver).toEqual([expect.stringContaining('går 4,1 minutt utan oppgåve (tilrådd høgst 4)')]);
    expect(long).toEqual([expect.stringContaining('går 11,5 minutt')]);
    expect(english).toEqual([expect.stringContaining('runs 11.5 minutes')]);
  });

  it('[PED-020][PED-H01] says a video just over the limit is longer than the limit', () => {
    // Act: a bookmark at 930 s (15.5 min) and one at 901 s (15.02 min)
    const halfOver = messagesOf(videoWithTasks([0, 241], 930), 'nn', 'PED-H01');
    const justOver = messagesOf(videoWithTasks([0, 241], 901), 'nn', 'PED-H01');
    // Assert
    expect(halfOver).toEqual([expect.stringContaining('minst 15,5 minutt lang (tilrådd høgst 15)')]);
    expect(justOver).toEqual([expect.stringContaining('minst 15,1 minutt lang')]);
  });
});
