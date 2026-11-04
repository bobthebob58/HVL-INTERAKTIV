/**
 * Unit tests of the insight aggregates on the fixture's InteractiveVideo (L01–L20) and ImageHotspots
 * (fixtures/README.md): video engagement, "not available" where the type sends no root result, and an activity that
 * sends no learning data.
 *
 * Spec: INS-001, INS-002, INS-003, INS-005
 */
import { describe, expect, it } from 'vitest';
import type { ChoiceMisconception, GapMisconception } from '../../src/insight/insightReport.js';
import { IMAGE_HOTSPOTS, INTERACTIVE_VIDEO, IV1, IV2, IV3 } from './fixtures/insightActivities.js';
import { videoRows } from './fixtures/thirtyLearners.js';
import { reportOf, shown } from './support/insightFixtureReport.js';

const video = reportOf(INTERACTIVE_VIDEO, videoRows(), { courseLearners: 40 });

describe('[INS-005] the video fixture', () => {
  it('[INS-005] shows the share of learners who answered each interaction, in playing order', () => {
    // Act and assert: the video report built above, against README.md's video table.
    expect(
      video.videoEngagement?.map((entry) => [
        entry.item,
        entry.atSeconds,
        entry.label,
        shown(entry.answered),
        shown(entry.share),
      ]),
    ).toEqual([
      [IV1, 150, 'Første stopp', 18, 0.9],
      [IV2, 300, null, 9, 0.45],
      [IV3, 450, 'Til slutt', '<k', '<k'],
    ]);
  });

  it('[INS-005] gives no video engagement for an activity that is not a video', () => {
    expect(reportOf(IMAGE_HOTSPOTS, []).videoEngagement).toBeNull();
  });
});

describe('[INS-001] the video fixture', () => {
  it('[INS-001] shows completed, the rate and attempts as not available, never 0, without a submit screen', () => {
    // Act and assert: null is "not available"; a suppressed cell would be { suppressed: true }.
    const { participation } = video;
    expect(participation).toMatchObject({
      completed: null,
      completionRate: null,
      completionBase: null,
      courseLearners: null,
      medianAttempts: null,
    });
    expect([shown(participation.started), shown(participation.medianMinutesOnTask)]).toEqual([20, 4.5]);
    expect(video.activity).toEqual({
      mainLibrary: 'H5P.InteractiveVideo',
      sendsLearningData: true,
      sendsRootResult: false,
    });
  });

  it('[INS-001] says that an ImageHotspots sends no learning data', () => {
    const hotspots = reportOf(IMAGE_HOTSPOTS, []);
    expect(hotspots.activity.sendsLearningData).toBe(false);
    expect(shown(hotspots.participation.started)).toBe(0);
    expect(hotspots.participation.completed).toBeNull();
    expect(hotspots.items).toEqual([]);
  });
});

describe('[INS-002] the video fixture', () => {
  it('[INS-002] sorts by the shown first-answer share and puts a suppressed item last', () => {
    expect(video.items.map((item) => [item.item, shown(item.learners), shown(item.firstCorrect)])).toEqual([
      [IV2, 9, 0.4444],
      [IV1, 18, 0.6667],
      [IV3, '<k', '<k'],
    ]);
  });
});

describe('[INS-003] the video fixture', () => {
  it('[INS-003] hides the one small option and the next-smallest cell, and a whole small question', () => {
    const iv1 = video.misconceptions.find(({ item }) => item === IV1) as ChoiceMisconception;
    expect(iv1.options.map(({ learners }) => shown(learners))).toEqual([12, 5, '<k']);
    expect(shown(iv1.noAnswer)).toBe('<k');
    const iv3 = video.misconceptions.find(({ item }) => item === IV3) as GapMisconception;
    expect(shown(iv3.learners)).toBe('<k');
    expect(
      iv3.gaps.flatMap((gap) => [gap.correct, gap.otherWrong, gap.empty].map((cell) => shown(cell))),
    ).toEqual(Array(6).fill('<k'));
    expect(video.misconceptions.some(({ item }) => item === IV2)).toBe(false);
  });
});
