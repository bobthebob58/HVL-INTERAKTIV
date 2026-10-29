/**
 * Browser integration tests for the PDF of the repository's own pedagogisk mappe (`content/mappe/`, ALU's drafts):
 * in Nynorsk, Bokmål and English, the PDF the export route makes with the server's Chromium is tagged, has an outline
 * that repeats the Markdown export's headings, the portfolio's language as /Lang, the first heading as its title, the
 * reader's guide as a table and the activities as real text, with no images (D-096). The tests compare the PDF with
 * the Markdown export of the same request and never assert ALU's texts (D-082, Q17).
 *
 * Spec: MAPPE-004, MAPPE-001
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LOCALES, type Locale } from '../../../src/i18n/translate.js';
import { firstTopHeading } from '../../../src/learningDesign/mappe/mappeWordCount.js';
import { openApiTestbed, type ApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { describeWithBrowser } from '../../support/browser.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { mappeHeadings } from './mappeMarkdownFacts.js';
import { runsAsRoot } from './taggedPdfLaunchRunner.js';
import { readTaggedPdf, type OutlineEntry } from './taggedPdfReader.js';

const TITLES = ['Blåbærquiz for Ærlege Øvingar', 'Åtte spørsmål'] as const;

const binary = (res: request.Response, done: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};
const flatten = (entries: readonly OutlineEntry[]): string[] =>
  entries.flatMap((entry) => [entry.title, ...flatten(entry.items)]);

describeWithBrowser('[MAPPE-004] the PDF of the repository’s own pedagogisk mappe', () => {
  describeWithServices('[MAPPE-004] through the export route', () => {
    let tb: ApiTestbed;
    let author: TestPrincipal;
    let ids: string[];
    const saved = process.env.PDF_ALLOW_NO_SANDBOX;
    const exportAs = (format: 'md' | 'pdf', locale: Locale) =>
      requestAs(tb.app, author, 'post', `/api/mappe/export?format=${format}`)
        .buffer(true)
        .parse(binary)
        .send({ contentIds: ids, locale });

    beforeAll(async () => {
      // WHY: root cannot use Chromium's sandbox; the non-root CI runner keeps it (D-096 contracts amendment).
      process.env.PDF_ALLOW_NO_SANDBOX = String(runsAsRoot);
      // WHY: no studio content is passed, so the testbed serves the repository's own content/, mappe included.
      tb = openApiTestbed();
      author = await tb.principal('author');
      ids = [
        await tb.content(author.principal.userId, { title: TITLES[0], status: 'published' }),
        await tb.content(author.principal.userId, { title: TITLES[1] }),
      ];
    });
    afterAll(async () => {
      await tb?.close();
      if (saved === undefined) delete process.env.PDF_ALLOW_NO_SANDBOX;
      else process.env.PDF_ALLOW_NO_SANDBOX = saved;
    });

    it.each(LOCALES)(
      '[MAPPE-004] in %s, is tagged, with the export’s headings as its outline, its language, title and real text',
      async (locale) => {
        // Act
        const markdown = (await exportAs('md', locale)).body.toString('utf8');
        const res = await exportAs('pdf', locale);
        const facts = await readTaggedPdf(res.body as Buffer);
        // Assert
        expect([res.status, res.headers['content-type']]).toEqual([200, 'application/pdf']);
        expect(facts.marked).toBe(true);
        expect(flatten(facts.outline)).toEqual(mappeHeadings(markdown).map(({ text }) => text));
        expect(facts.language).toBe(locale);
        expect(facts.title).toBe(firstTopHeading(markdown));
        expect(facts.structure).toMatch(/^Document\(H1 .*Table\(TR\(TH TH TH\) TR\(TH TD TD\)/);
        expect(facts.textItems).toEqual(expect.arrayContaining([...TITLES]));
        expect(facts.imageCount).toBe(0);
        expect(facts.fonts.every((font) => font.embedded)).toBe(true);
      },
      60_000,
    );
  });
});
