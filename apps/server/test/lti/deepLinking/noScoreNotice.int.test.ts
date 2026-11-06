/**
 * Integration test for the Deep Linking picker's note on activities that can never send Canvas a score (D-115),
 * from a mock Canvas launch through the whole app: on `assignment_selection` the picker names ImageHotspots, an
 * InteractiveVideo without a submit screen and a BranchingScenario without scoring, in the launch's language; a link
 * placement, which makes no gradebook column, says nothing.
 *
 * Spec: LTI-005, LTI-012, LTI-013
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { t } from '../../../src/i18n/translate.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[LTI-005] the picker names activities that send Canvas no score', () => {
  let tb: AppTestbed;
  const teacher = { sub: `teacher-${randomUUID()}`, roles: CANVAS_USERS.teacher.roles };
  const ids: Record<string, string> = {};
  const pickerFor = async (spec: LaunchSpec) => {
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: teacher,
      ...spec,
    });
    return request(tb.app).get(`/lti/deeplink?ltik=${encodeURIComponent(run.ltik ?? '')}`);
  };
  /** A published activity row of a type and params, owned by the teacher (the picker reads only the database). */
  const stored = (ownerUserId: string, mainLibrary: string, title: string, params: object) =>
    tb.db.h5PContent.create({
      data: { mainLibrary, title, params, metadata: { title }, status: 'published', ownerUserId },
      select: { id: true },
    });

  beforeAll(async () => {
    tb = await openAppTestbed();
    const first = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: teacher,
    });
    const owner = (await tb.lti.resolveLtik(first.ltik ?? '')).principal.userId;
    const video = { interactiveVideo: { assets: { endscreens: [] } } };
    const scenario = { branchingScenario: { scoringOptionGroup: { scoringOption: 'no-score' } } };
    const scoredVideo = { interactiveVideo: { assets: { endscreens: [{ time: 10, label: '0:10' }] } } };
    ids.hotspots = (await stored(owner, 'H5P.ImageHotspots', 'Klikkpunkt', {})).id;
    ids.video = (await stored(owner, 'H5P.InteractiveVideo', 'Video', video)).id;
    ids.scenario = (await stored(owner, 'H5P.BranchingScenario', 'Case', scenario)).id;
    ids.scoredVideo = (await stored(owner, 'H5P.InteractiveVideo', 'Video med innsending', scoredVideo)).id;
    ids.quiz = await tb.activity(owner, { published: true, title: 'Quiz' });
  }, 60_000);
  afterAll(() => tb?.close());

  /** The `aria-describedby` of an activity's input, or undefined. */
  const describedBy = (html: string, id: string) =>
    new RegExp(`value="${id}"(?: aria-describedby="([^"]+)")?>`).exec(html)?.[1];

  it('[LTI-005] on assignment_selection each activity that sends no score says why, tied to its input', async () => {
    // Act
    const res = await pickerFor({ placement: 'assignment_selection' });
    // Assert
    expect(res.status).toBe(200);
    for (const [key, reason] of [
      ['hotspots', 'noStatements'],
      ['video', 'noSubmitScreen'],
      ['scenario', 'noScoring'],
    ] as const) {
      const noteId = describedBy(res.text, ids[key] ?? '');
      expect(noteId).toMatch(/^activity-\d+-no-score$/);
      expect(res.text).toContain(
        `<span id="${noteId}">${t(`deepLinkGrading.noScore.${reason}`, {}, 'nn')}</span>`,
      );
    }
    expect(describedBy(res.text, ids.scoredVideo ?? '')).toBeUndefined();
    expect(describedBy(res.text, ids.quiz ?? '')).toBeUndefined();
  });

  it('[LTI-013] the note follows the launch’s language', async () => {
    const res = await pickerFor({ placement: 'assignment_selection', locale: 'en' });
    expect(res.text).toContain(t('deepLinkGrading.noScore.noSubmitScreen', {}, 'en'));
    expect(res.text).not.toContain(t('deepLinkGrading.noScore.noSubmitScreen', {}, 'nn'));
  });

  it('[LTI-005] a link placement makes no gradebook column, so the picker says nothing about scores', async () => {
    const res = await pickerFor({ placement: 'link_selection', acceptMultiple: true });
    expect(res.status).toBe(200);
    expect(res.text).toContain(`value="${ids.video}"`);
    expect(res.text).not.toContain('-no-score');
  });
});
