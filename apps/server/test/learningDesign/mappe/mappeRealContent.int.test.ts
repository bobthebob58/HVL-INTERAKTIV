/**
 * Integration tests for the repository's own pedagogisk mappe (`content/mappe/`, ALU's drafts) through the routes: a
 * fixture author's Markdown export in Nynorsk, Bokmål and English holds the reader's guide with one row per criterion
 * of the default set and the chosen activities, with every tag filled in; the preview reports the set's limits and a
 * word count; and the three languages have the same headings. The tests read the loaded content and never assert
 * ALU's texts, labels or counts (D-082, Q17).
 *
 * Spec: MAPPE-001, MAPPE-002, PROD-012
 */
import { DEFAULT_CRITERIA_SET, MARKDOWN_MEDIA_TYPE } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LOCALES, type Locale } from '../../../src/i18n/translate.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { storeMetadata } from '../metadata/metadataFixtures.js';
import { mappeHeadings, readersGuideRows, templateLeftovers } from './mappeMarkdownFacts.js';

const TITLES = ['Blodtrykk i forarbeidet', 'Åtte spørsmål om væskebalanse'] as const;

describeWithServices('[MAPPE-001] exporting the repository’s own pedagogisk mappe', () => {
  // WHY: no studio content is passed, so the testbed serves the repository's own content/, mappe included.
  const tb = openApiTestbed();
  let author: TestPrincipal;
  let ids: string[];
  const body = (locale: Locale) => ({ contentIds: ids, locale });
  const exportMd = (locale: Locale) =>
    requestAs(tb.app, author, 'post', '/api/mappe/export?format=md').send(body(locale));

  beforeAll(async () => {
    author = await tb.principal('author');
    const colleague = await tb.principal('author');
    const me = author.principal.userId;
    ids = [
      await tb.content(me, { title: TITLES[0], status: 'published' }),
      await tb.content(colleague.principal.userId, { title: TITLES[1], coAuthors: [me] }),
    ];
    const { phases } = tb.studio.content.phases;
    await storeMetadata(tb.db, ids[0] ?? '', {
      courseCode: 'SYK110',
      phase: phases[0]?.key,
      outcomes: [{ text: 'Forklare blodtrykk', category: 'kunnskap' }],
      rationale: 'Studentane ser videoen før samlinga.',
      ...(tb.studio.content.patterns.patterns[0]
        ? { patternId: tb.studio.content.patterns.patterns[0].id }
        : {}),
    });
  });
  afterAll(() => tb.close());

  const defaultSet = () =>
    tb.studio.content.mappe.portfolio?.criteriaSets.find(({ id }) => id === DEFAULT_CRITERIA_SET);

  it('[MAPPE-001] the criteria sets route offers the content’s sets with the default set', async () => {
    // Act
    const res = await requestAs(tb.app, author, 'get', '/api/mappe/criteria-sets');
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.defaultSet).toBe(DEFAULT_CRITERIA_SET);
    expect(res.body.sets.map((set: { id: string }) => set.id)).toEqual(
      tb.studio.content.mappe.portfolio?.criteriaSets.map(({ id }) => id),
    );
  });

  it.each(LOCALES)(
    '[MAPPE-001] in %s, the Markdown export holds the reader’s guide, one row per criterion, and both activities',
    async (locale) => {
      // Act
      const res = await exportMd(locale);
      // Assert
      expect([res.status, res.headers['content-type']]).toEqual([
        200,
        expect.stringContaining(MARKDOWN_MEDIA_TYPE),
      ]);
      const rows = readersGuideRows(res.text, locale) ?? [];
      expect(rows.map((row) => row[0]?.split(' ')[0])).toEqual(defaultSet()?.criteria.map(({ id }) => id));
      expect(mappeHeadings(res.text).map(({ text }) => text)).toEqual(expect.arrayContaining([...TITLES]));
      expect(templateLeftovers(res.text)).toEqual([]);
    },
  );

  it.each(LOCALES)(
    '[MAPPE-002] in %s, the preview counts the words of Del 1 against the default set’s limits',
    async (locale) => {
      // Act
      const res = await requestAs(tb.app, author, 'post', '/api/mappe/preview').send(body(locale));
      // Assert
      const set = defaultSet();
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        criteriaSet: DEFAULT_CRITERIA_SET,
        wordLimit: set?.limits.del1Words.value,
        attachmentLimit: set?.limits.attachments.value,
      });
      expect(res.body.words).toBeGreaterThan(0);
      expect(res.body.attachments).toBeGreaterThan(0);
      expect(res.body.attachments).toBeLessThanOrEqual(res.body.attachmentLimit);
    },
  );

  it('[PROD-012] the three languages export the same headings by level, with the same preview counts of attachments', async () => {
    // Act
    const exports = await Promise.all(LOCALES.map((locale) => exportMd(locale)));
    const previews = await Promise.all(
      LOCALES.map((locale) => requestAs(tb.app, author, 'post', '/api/mappe/preview').send(body(locale))),
    );
    // Assert
    const levels = exports.map((res) => mappeHeadings(res.text).map(({ level }) => level));
    expect(levels[1]).toEqual(levels[0]);
    expect(levels[2]).toEqual(levels[0]);
    expect(new Set(previews.map((res) => res.body.attachments)).size).toBe(1);
  });
});
