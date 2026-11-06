/**
 * noScoreActivity — gives the teacher of the Deep Linking picker a published activity whose type can never send
 * Canvas a score (H5P.ImageHotspots, D-115), so the picker shows its no-score note, and takes it away again.
 *
 * Why: UD-030 scans every view in the state a person meets it in. The picker says, next to such an activity and tied
 *      to its input, that its gradebook column will stay empty (LTI-012, D-115); the harness's teacher owns only
 *      MultiChoice activities (../../test/support/realWebApp.ts), so without this the note is never on the page.
 * Spec: UD-030, LTI-012
 * Invariants:
 *   - The activity is the real ImageHotspots example, imported as the teacher whose launch made the ltik, so the
 *     picker lists it among the teacher's own; `remove` deletes it, so the picker's other scans list the teacher's
 *     two activities only, and ../../test/support/appTestbed.ts's cleanup would remove it with the teacher anyway.
 * Collaborators: ../axeServerPages.a11y.test.ts, ../../test/support/realWebApp.ts (`deepLink`, `tb.lti`),
 *   ../../test/support/realPackages.ts.
 * Tests: apps/server/a11y/axeServerPages.a11y.test.ts
 */
import { join } from 'node:path';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { REAL_PACKAGES_DIR } from '../../test/support/realPackages.js';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { testActor } from '../../test/support/testActors.js';

/** The teacher's activity that sends no score, and how to take it away. */
export interface NoScoreActivity {
  /** The activity's ID, the value of its input in the picker. */
  readonly id: string;
  /** Deletes the activity. */
  remove(): Promise<void>;
}

/**
 * Imports and publishes the real ImageHotspots example as the activity of the teacher whose picker launch made `ltik`.
 * @param app - The running server, with the real libraries installed.
 * @param ltik - The picker launch's ltik (`app.deepLink()`).
 * @returns The activity and its removal.
 */
export async function addNoScoreActivity(app: RealWebApp, ltik: string): Promise<NoScoreActivity> {
  const { userId } = (await app.tb.lti.resolveLtik(ltik)).principal;
  const teacher = asAccountUser(testActor('author', { accountId: userId }));
  const file = join(REAL_PACKAGES_DIR, 'H5P.ImageHotspots.h5p');
  const imported = await app.tb.runtime.editor.packageImporter.addPackageLibrariesAndContent(file, teacher);
  const id = String(imported.id);
  await app.tb.db.h5PContent.update({
    where: { id },
    data: { status: 'published', visibility: 'organisation' },
  });
  return {
    id,
    remove: async () => {
      await app.tb.db.h5PContent.delete({ where: { id } });
    },
  };
}
