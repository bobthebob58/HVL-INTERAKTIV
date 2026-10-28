/**
 * placeholderMarkerCreation — stores probe P6's activities in the two ways content reaches storage: through
 * HvlH5PEditor's save path, and through Lumi's package import as a content-only `.h5p` (h5p.json and content.json, no
 * library folders) for the installed real libraries.
 *
 * Why: the save path sanitises every text and the title, but Lumi's package import writes content.json as it is
 *      (ContentStorer.copyFromDirectoryToStorage runs no SemanticsEnforcer), so an import is the one way the probe
 *      can give H5P's editor a marker written as character references, and show what V-PLACEHOLDER meets in content
 *      that has not been saved since (D-086).
 * Spec: PROD-001
 * Invariants: the save path gets a copy of the parameters (it changes them in place); a package names only the main
 *   library, which must be installed; packages are removed with `removeBuiltPackages` from
 *   ../../support/h5pPackageBuilder.ts, and the activities by the testbed's `close()` (they belong to the author).
 * Collaborators: ../../../src/h5p/HvlH5PEditor.ts, ../../support/h5pPackageBuilder.ts, ../../support/httpTestbed.ts,
 *   ./placeholderMarkerActivities.ts.
 * Tests: apps/server/test/learningDesign/patterns/placeholderMarker.browser.int.test.ts
 */
import type { IContentMetadata, IUser } from '@lumieducation/h5p-server';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { buildH5pPackage } from '../../support/h5pPackageBuilder.js';
import type { HttpTestbed, TestActor } from '../../support/httpTestbed.js';
import { markedActivities, type MarkedActivity } from './placeholderMarkerActivities.js';

/** One stored activity of the probe and the way it was stored. */
export interface ProbeActivity {
  readonly how: 'saved' | 'imported';
  readonly activity: MarkedActivity;
  readonly id: string;
}

/**
 * The metadata the probe saves with: the marked title, Nynorsk, no licence.
 * @param activity - The activity.
 * @returns h5p.json fields for the save path.
 */
export const metadataOf = (activity: MarkedActivity): IContentMetadata =>
  ({ title: activity.title, license: 'U', defaultLanguage: 'nn' }) as IContentMetadata;

/**
 * Saves a new activity through HvlH5PEditor's save path, as the content API does.
 * @param tb - The testbed with the real libraries installed.
 * @param activity - The activity.
 * @param user - The author (account view).
 * @returns The new activity's ID.
 */
export function saveThroughEditor(tb: HttpTestbed, activity: MarkedActivity, user: IUser): Promise<string> {
  const params = structuredClone(activity.params);
  return tb.runtime.editor.saveOrUpdateContent(
    undefined,
    params,
    metadataOf(activity),
    activity.library,
    user,
  );
}

/**
 * Imports an activity as a package, as an admin's import or a seed fixture would store it.
 * @param tb - The testbed with the real libraries installed.
 * @param author - The owner of the imported activity.
 * @param activity - The activity; its title goes into h5p.json as written.
 * @returns The new activity's ID.
 */
export async function importAsPackage(
  tb: HttpTestbed,
  author: TestActor,
  activity: MarkedActivity,
): Promise<string> {
  const [machineName = '', version = ''] = activity.library.split(' ');
  const [majorVersion, minorVersion] = version.split('.').map(Number);
  const h5pJson = {
    title: activity.title,
    language: 'nn',
    defaultLanguage: 'nn',
    mainLibrary: machineName,
    embedTypes: ['iframe'],
    license: 'U',
    preloadedDependencies: [{ machineName, majorVersion, minorVersion }],
  };
  const path = await buildH5pPackage({
    main: { machineName, majorVersion, minorVersion },
    omitMainFolder: true,
    params: activity.params,
    // WHY: the builder's own h5p.json has a fixed title; this one carries the marked title.
    files: { 'h5p.json': JSON.stringify(h5pJson) },
  });
  return tb.importPackage(author, path);
}

/**
 * Stores the four activities with raw markers through the save path, and the four with decimal references through
 * a package import.
 * @param tb - The testbed with the real libraries installed.
 * @param author - Their owner.
 * @returns The eight activities, saved ones first.
 */
export async function storeProbeActivities(tb: HttpTestbed, author: TestActor): Promise<ProbeActivity[]> {
  const stored: ProbeActivity[] = [];
  const user = asAccountUser(author.actor);
  for (const activity of markedActivities('raw'))
    stored.push({ how: 'saved', activity, id: await saveThroughEditor(tb, activity, user) });
  for (const activity of markedActivities('decimal'))
    stored.push({ how: 'imported', activity, id: await importAsPackage(tb, author, activity) });
  return stored;
}
