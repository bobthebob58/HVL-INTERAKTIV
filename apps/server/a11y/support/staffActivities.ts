/**
 * staffActivities — the people and activities the accessibility suites write for the studio: a findable HVL staff
 * colleague, the real MultiChoice example imported as someone's activity, and a colleague's activity with the run
 * author as its co-author (the only way the suites can see the **Deling** tab as a co-author sees it).
 *
 * Why: the harness signs in only the run author, who owns every example; «Fjern meg» and the lasting message after it
 *      exist only for a co-author (PROD-007, D-090). The rows are written as the routes store them, and the content
 *      is the real package, since H5P's validator refuses stand-in params for the real MultiChoice.
 * Spec: UD-030, UD-006, PROD-007
 * Invariants:
 *   - Every account is made with `tb.staffAccount` and every activity is owned by one or by the run author, so
 *     ../../test/support/appTestbed.ts's cleanup removes them with their co-author rows.
 *   - Names are this file's fixture texts, never a real person's.
 * Collaborators: ./studioSeed.ts (the shared seed), ../../test/support/appTestbed.ts,
 *   ../../test/support/realPackages.ts.
 * Tests: apps/server/a11y/keyboardStudioJourneys.a11y.test.ts and every suite that walks ./catalogue.ts's views.
 */
import { join } from 'node:path';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { REAL_PACKAGES_DIR } from '../../test/support/realPackages.js';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { testActor } from '../../test/support/testActors.js';

/**
 * A findable HVL staff colleague (D-090): a staff account with a name and a recent eligible Feide login.
 * @param app - The running server.
 * @param name - The colleague's display name.
 * @returns The colleague's `User.id`.
 */
export async function findableColleague(app: RealWebApp, name: string): Promise<string> {
  const id = await app.tb.staffAccount();
  await app.tb.db.user.update({
    where: { id },
    data: { displayName: name, coAuthorSearchableAt: new Date() },
  });
  return id;
}

/**
 * Imports the real MultiChoice example as an activity of `ownerId`.
 * @param app - The running server, with the real libraries installed.
 * @param ownerId - The owner's `User.id`.
 * @returns The activity's ID.
 */
export async function importMultiChoice(app: RealWebApp, ownerId: string): Promise<string> {
  const owner = asAccountUser(testActor('author', { accountId: ownerId }));
  const file = join(REAL_PACKAGES_DIR, 'H5P.MultiChoice.h5p');
  const { id } = await app.tb.runtime.editor.packageImporter.addPackageLibrariesAndContent(file, owner);
  return String(id);
}

/**
 * A new findable colleague's published activity with the run author as its co-author.
 * @param app - The running server.
 * @param ownerName - The colleague's display name.
 * @returns The activity's ID.
 */
export async function coAuthoredActivity(app: RealWebApp, ownerName: string): Promise<string> {
  const contentId = await importMultiChoice(app, await findableColleague(app, ownerName));
  await app.tb.db.h5PContent.update({
    where: { id: contentId },
    data: { status: 'published', visibility: 'organisation' },
  });
  await app.tb.db.contentCollaborator.create({
    data: { contentId, userId: app.authorId, role: 'coauthor' },
  });
  return contentId;
}
