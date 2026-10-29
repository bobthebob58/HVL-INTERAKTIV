/**
 * Integration tests for the course label a real Canvas launch stores on its placement (D-087, 2026-10-28 contracts
 * amendment): a course code is kept, a label that may name a person is not, and each launch overwrites the value.
 * The launches run through the real ltijs routes against the mock Canvas.
 *
 * Spec: PED-030, DATA-002, LTI-006
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices, uniqueName } from '../../support/services.js';

describeWithServices('[PED-030] the course label of a placement', () => {
  let tb: AppTestbed;
  let published: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    published = await tb.activity(await tb.staffAccount(), { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  const launchIn = (course: { id: string; label?: string }, resourceLinkId: string) =>
    launchFromCanvas(tb.app, tb.mock.canvas, { custom: { contentId: published }, course, resourceLinkId });
  const labelOf = async (contextId: string) =>
    (await tb.db.ltiPlacement.findFirstOrThrow({ where: { contextId, contentId: published } })).contextLabel;

  it('[PED-030] a launch from a course whose label is a course code stores it on the placement', async () => {
    // Arrange
    const course = { id: uniqueName('course'), label: 'SYK110' };
    // Act
    const run = await launchIn(course, uniqueName('link'));
    // Assert
    expect(run.res.status).toBe(302);
    expect(await labelOf(course.id)).toBe('SYK110');
  });

  it('[DATA-002] a sandbox label with a teacher’s name is not stored, and a later launch overwrites a stored code', async () => {
    // Arrange
    const id = uniqueName('course');
    const link = uniqueName('link');
    await launchIn({ id, label: 'MAT101' }, link);
    // Act
    const renamed = await launchIn({ id, label: 'Sandkasse Kari Nordmann' }, link);
    // Assert
    expect(renamed.res.status).toBe(302);
    expect(await labelOf(id)).toBeNull();
    expect(JSON.stringify(await tb.db.ltiPlacement.findMany({ where: { contextId: id } }))).not.toContain(
      'Kari',
    );
  });
});
