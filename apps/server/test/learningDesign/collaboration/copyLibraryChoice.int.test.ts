/**
 * Integration tests of the library version a «Lagre som ny versjon» copy is saved with (D-093 amendment, S5 W4): the
 * editor's minor version of the source's library when it is installed, else the source's own; «Lag ein kopi» always
 * keeps the source's. A fake second minor version of H5P.MultiChoice (1.17 next to 1.16) stands in for an upgrade.
 *
 * Spec: PROD-013, PROD-007, H5P-002
 */
import type { IContentMetadata } from '@lumieducation/h5p-server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { ContentDuplicator } from '../../../src/learningDesign/collaboration/ContentDuplicator.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithServices } from '../../support/services.js';
import { HTTP_TEST_LIBRARIES, MULTI_CHOICE } from '../../support/tenTypeLibraries.js';

describeWithServices('[PROD-013] the library version of a saved copy', () => {
  let tb: HttpTestbed;
  let owner: TestActor;
  let duplicator: ContentDuplicator;
  let sourceId: string;

  beforeAll(async () => {
    tb = await openHttpTestbed([...HTTP_TEST_LIBRARIES, { ...MULTI_CHOICE, minorVersion: 17 }]);
    owner = await tb.actor('author');
    duplicator = new ContentDuplicator({
      db: tb.db,
      editor: tb.runtime.editor,
      access: new PrismaContentAccessRepository(tb.db),
    });
    sourceId = await tb.activity(owner, { library: 'H5P.MultiChoice 1.16' });
  }, 60_000);
  afterAll(() => tb.close());

  /** The main library's `major.minor` in a stored activity's h5p.json. */
  const versionOf = async (contentId: string): Promise<string> => {
    const row = await tb.db.h5PContent.findUniqueOrThrow({
      where: { id: contentId },
      select: { metadata: true },
    });
    const metadata = row.metadata as unknown as IContentMetadata;
    const main = metadata.preloadedDependencies.find((d) => d.machineName === metadata.mainLibrary);
    return `${String(main?.majorVersion)}.${String(main?.minorVersion)}`;
  };
  const saveAsCopy = async (library: string | undefined) => {
    const { params, metadata } = await tb.db.h5PContent.findUniqueOrThrow({ where: { id: sourceId } });
    const copy = await duplicator.saveAsCopy(
      sourceId,
      params as object,
      metadata as unknown as IContentMetadata,
      owner.actor,
      library,
    );
    return versionOf(copy.contentId);
  };

  it.each([
    ['the installed newer minor version the editor names', 'H5P.MultiChoice 1.17', '1.17'],
    ['a minor version that is not installed', 'H5P.MultiChoice 1.18', '1.16'],
    ['another major version', 'H5P.MultiChoice 2.0', '1.16'],
    ['another content type', 'H5P.QuestionSet 1.21', '1.16'],
    ['a name that is not a library', 'H5P.MultiChoice', '1.16'],
    ['no library at all', undefined, '1.16'],
  ])('[PROD-013] %s gives %s → %s', async (_name, library, version) => {
    expect(await saveAsCopy(library)).toBe(version);
  });

  it('[PROD-007] «Lag ein kopi» keeps the source’s version, whatever is installed', async () => {
    // Act
    const { contentId } = await duplicator.duplicate(sourceId, owner.actor);
    // Assert
    expect(await versionOf(sourceId)).toBe('1.16');
    expect(await versionOf(contentId)).toBe('1.16');
  });
});
