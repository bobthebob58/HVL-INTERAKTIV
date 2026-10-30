/**
 * Integration tests of a copy's source attribution in `GET /api/content/:contentId` (D-092 as amended): the source's
 * title with its language and its author's current name for people who may edit the copy only; unknown parts left
 * out.
 *
 * Spec: PROD-007, DATA-002, H5P-006, UD-010
 */
import { contentDetailSchema } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { personNamed, runToken } from './collaborationFixtures.js';

const TOKEN = runToken();
const ATTRIBUTION_KEYS = ['sourceContentId', 'sourceTitle', 'sourceLanguage', 'sourceAuthorName'];

describeWithServices('[PROD-007] where a copy came from', () => {
  const tb = openApiTestbed();
  let author: TestPrincipal;
  let copier: TestPrincipal;

  /**
   * A published source in English, and a copy of it owned by the copier, linked as the duplicator links it.
   * WHY: every source states its language, so a test that expects no `sourceLanguage` proves it was held back.
   */
  const copyOf = async (source: { visibility: 'organisation' | 'private' }, copy = {}) => {
    const sourceId = await tb.content(author.principal.userId, {
      title: `Kjelde ${TOKEN}`,
      status: 'published',
      visibility: source.visibility,
    });
    const stored = await tb.db.h5PContent.findUniqueOrThrow({ where: { id: sourceId } });
    await tb.db.h5PContent.update({
      where: { id: sourceId },
      data: { metadata: { ...(stored.metadata as object), defaultLanguage: 'en' } },
    });
    const copyId = await tb.content(copier.principal.userId, { title: `Kopi ${TOKEN}`, ...copy });
    await tb.db.h5PContent.update({
      where: { id: copyId },
      data: { sourceContentId: sourceId, sourceAuthorUserId: author.principal.userId },
    });
    return { sourceId, copyId };
  };
  const detail = async (who: TestPrincipal, contentId: string) =>
    contentDetailSchema.parse((await requestAs(tb.app, who, 'get', `/api/content/${contentId}`)).body);

  beforeAll(async () => {
    author = await personNamed(tb, `Ola ${TOKEN} Opphav`);
    copier = await personNamed(tb, `Kari ${TOKEN} Kopist`);
  });
  afterAll(() => tb.close());

  it('[PROD-007] the copy’s editor sees the source’s title, its language and the author’s current name', async () => {
    // Arrange
    const { sourceId, copyId } = await copyOf({ visibility: 'organisation' });
    await tb.db.user.update({
      where: { id: author.principal.userId },
      data: { displayName: `Ola ${TOKEN} Nytt` },
    });
    // Act
    const seen = await detail(copier, copyId);
    // Assert
    expect(seen).toMatchObject({
      sourceContentId: sourceId,
      sourceTitle: `Kjelde ${TOKEN}`,
      sourceLanguage: 'en',
      sourceAuthorName: `Ola ${TOKEN} Nytt`,
    });
  });

  it('[PROD-007] learners and colleagues who may only view the copy get no attribution', async () => {
    // Arrange: the copy is published and shared, so others may view it
    const { copyId } = await copyOf(
      { visibility: 'organisation' },
      { status: 'published', visibility: 'organisation' },
    );
    const colleague = await personNamed(tb, `Lesar ${TOKEN}`);
    const learner = await tb.principal('learner');
    // Act
    const seen = [await detail(colleague, copyId), await detail(learner, copyId)];
    // Assert
    for (const view of seen) {
      expect(view.mayEdit).toBe(false);
      for (const key of ATTRIBUTION_KEYS) expect(view).not.toHaveProperty(key);
    }
  });

  it('[PROD-007] a source the editor may no longer view is not named; its author still is', async () => {
    const { copyId } = await copyOf({ visibility: 'private' });
    const seen = await detail(copier, copyId);
    expect(seen).not.toHaveProperty('sourceContentId');
    expect(seen).not.toHaveProperty('sourceTitle');
    expect(seen).not.toHaveProperty('sourceLanguage');
    expect(seen.sourceAuthorName).toContain(`Ola ${TOKEN}`);
  });

  it('[PROD-007] a deleted source and an author without a name are left out; an original has none', async () => {
    // Arrange
    const { sourceId, copyId } = await copyOf({ visibility: 'organisation' });
    await tb.db.h5PContent.delete({ where: { id: sourceId } });
    await tb.db.user.update({ where: { id: author.principal.userId }, data: { displayName: null } });
    const original = await tb.content(copier.principal.userId);
    // Act
    const seen = [await detail(copier, copyId), await detail(copier, original)];
    // Assert
    for (const view of seen) for (const key of ATTRIBUTION_KEYS) expect(view).not.toHaveProperty(key);
    await tb.db.user.update({
      where: { id: author.principal.userId },
      data: { displayName: `Ola ${TOKEN} Nytt` },
    });
  });
});
