/**
 * Integration tests for the learner info of a real Canvas launch into the web app's chrome page (D-087): the stored
 * minutes and purpose reach the web app in `x-hvli-launch` through the real LTI routes, never the rationale, the
 * course code or the outcomes; a purpose the web app's strict parser would refuse is left out instead. The web app
 * is a stub that records what it received.
 *
 * Spec: PED-032, PED-030, LTI-006
 */
import type { IncomingMessage } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { LAUNCH_HEADER } from '../../src/web/appLaunch.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices, uniqueName } from '../support/services.js';
import { storeMetadata } from '../learningDesign/metadata/metadataFixtures.js';

const AUTHORS_OWN = {
  rationale: 'Grunngjeving berre for forfattaren',
  courseCode: 'SYK110',
  outcomes: [{ text: 'Forklare blodtrykksregulering', category: 'kunnskap' as const }],
};

describeWithServices('[PED-032] the learner info in a real Canvas launch', () => {
  let tb: AppTestbed;
  const seen: IncomingMessage[] = [];
  beforeAll(async () => {
    tb = await openAppTestbed(undefined, {
      web: { dev: false, handle: async (req, res) => void (seen.push(req), res.end('web')) },
    });
  }, 60_000);
  afterAll(() => tb?.close());

  /** Launches a student into an activity with this metadata and returns the launch the web app received. */
  const launchWith = async (learner: { estimatedStudentMinutes: number; learnerPurpose: string }) => {
    const published = await tb.activity(await tb.staffAccount(), { published: true, title: 'Brøkar' });
    await storeMetadata(tb.db, published, { ...AUTHORS_OWN, ...learner });
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: CANVAS_USERS.student,
      custom: { contentId: published },
      resourceLinkId: uniqueName('link'),
    });
    seen.length = 0;
    await request(tb.app).get(`/app/play?ltik=${encodeURIComponent(run.ltik ?? '')}`);
    return { published, header: String(seen[0]?.headers[LAUNCH_HEADER]) };
  };

  it('[PED-032] a student’s launch carries the minutes and the purpose, and nothing else of the learning design', async () => {
    // Act
    const { published, header } = await launchWith({
      estimatedStudentMinutes: 15,
      learnerPurpose: 'Du øver før samlinga.',
    });
    // Assert
    expect(JSON.parse(decodeURIComponent(header))).toMatchObject({
      contentId: published,
      estimatedStudentMinutes: 15,
      learnerPurpose: 'Du øver før samlinga.',
    });
    for (const authorsOwn of [AUTHORS_OWN.rationale, AUTHORS_OWN.courseCode, 'blodtrykksregulering']) {
      expect(decodeURIComponent(header)).not.toContain(authorsOwn);
    }
  });

  it('[PED-032] a stored purpose with a tab is left out, so the launch still reaches the page', async () => {
    // Act
    const { published, header } = await launchWith({ estimatedStudentMinutes: 5, learnerPurpose: 'Ein\tTo' });
    // Assert
    const launch = JSON.parse(decodeURIComponent(header));
    expect(launch).toMatchObject({ contentId: published, estimatedStudentMinutes: 5 });
    expect(launch).not.toHaveProperty('learnerPurpose');
  });
});
