/**
 * Browser integration tests for the pedagogisk mappe PDF (MAPPE-004, D-096): the PDF the export route makes with the
 * server's own Chromium has a structure tree, an outline that repeats the Markdown's headings, the document language,
 * the template's title and real text with æøå in embedded fonts; nothing is left in the temporary folder; and the
 * route's 503 answers (no browser; every slot busy, with `Retry-After`) leave the Markdown export working.
 *
 * Spec: MAPPE-004, MAPPE-003
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { learningDesignError } from '../../../src/http/learningDesignErrors.js';
import { firstTopHeading } from '../../../src/learningDesign/mappe/mappeWordCount.js';
import { pdfBrowserLaunchOptions } from '../../../src/learningDesign/mappe/pdf/SharedChromium.js';
import { openApiTestbed, type ApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { describeWithBrowser } from '../../support/browser.js';
import { studioContentWithMappe } from '../../support/mappeFixture.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { runsAsRoot } from './taggedPdfLaunchRunner.js';
import { readTaggedPdf, type OutlineEntry } from './taggedPdfReader.js';

const binary = (res: request.Response, done: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

const headingsOf = (markdown: string): string[] => {
  const tokens = new MarkdownIt().parse(markdown, {});
  return tokens.flatMap((token, index) =>
    token.type === 'heading_open'
      ? [(tokens[index + 1]?.children ?? []).map((child) => child.content).join('')]
      : [],
  );
};
const flatten = (entries: readonly OutlineEntry[]): string[] =>
  entries.flatMap((entry) => [entry.title, ...flatten(entry.items)]);

/** An activity title that wraps on an A4 page, so the outline test covers a heading's line break. */
const LONG_TITLE =
  'Undervegsvurdering med tilbakemelding på kvart svar i eit langt emne om formativ vurdering og læringsdesign';
describeWithBrowser('[MAPPE-004] the portfolio PDF from the server’s Chromium', () => {
  describeWithServices('[MAPPE-004] through the export route', () => {
    let tb: ApiTestbed;
    let missing: ApiTestbed;
    let author: TestPrincipal;
    let ids: string[];
    let temporary: string;
    const saved = { TMPDIR: process.env.TMPDIR, PDF_ALLOW_NO_SANDBOX: process.env.PDF_ALLOW_NO_SANDBOX };
    const body = (locale = 'nn') => ({ contentIds: ids, locale });
    const exportAs = (bed: ApiTestbed, format: 'md' | 'pdf', locale = 'nn') =>
      requestAs(bed.app, author, 'post', `/api/mappe/export?format=${format}`)
        .buffer(true)
        .parse(binary)
        .send(body(locale));

    beforeAll(async () => {
      // WHY: root cannot use Chromium's sandbox; the non-root CI runner keeps it (D-096 contracts amendment).
      process.env.PDF_ALLOW_NO_SANDBOX = String(runsAsRoot);
      // WHY: a folder of its own for this process's temporary files, to show that an export leaves none behind.
      temporary = mkdtempSync(join(tmpdir(), 'hvli-mappe-pdf-'));
      process.env.TMPDIR = temporary;
      tb = openApiTestbed({ studioContent: studioContentWithMappe() });
      process.env.PDF_BROWSER_EXECUTABLE = '/nonexistent/chromium';
      missing = openApiTestbed({ studioContent: studioContentWithMappe() });
      delete process.env.PDF_BROWSER_EXECUTABLE;
      author = await tb.principal('author');
      ids = [
        await tb.content(author.principal.userId, {
          title: 'Blåbærquiz for Ærlege Øvingar',
          status: 'published',
        }),
        await tb.content(author.principal.userId, { title: 'Åtte spørsmål' }),
        // WHY: a title long enough to wrap: Chromium's outline joins the words at a wrap unless headings keep it.
        await tb.content(author.principal.userId, { title: LONG_TITLE }),
      ];
    });
    afterAll(async () => {
      await missing?.close();
      await tb?.close();
      process.env.TMPDIR = saved.TMPDIR;
      process.env.PDF_ALLOW_NO_SANDBOX = saved.PDF_ALLOW_NO_SANDBOX;
      if (saved.TMPDIR === undefined) delete process.env.TMPDIR;
      if (saved.PDF_ALLOW_NO_SANDBOX === undefined) delete process.env.PDF_ALLOW_NO_SANDBOX;
      rmSync(temporary, { recursive: true, force: true });
    });

    it('[MAPPE-004] is tagged, with an outline of the headings, the language, the title and real text with æøå', async () => {
      // Act
      const markdown = (await exportAs(tb, 'md')).body.toString('utf8');
      const res = await exportAs(tb, 'pdf');
      const facts = await readTaggedPdf(res.body as Buffer);
      // Assert
      expect([res.status, res.headers['content-type']]).toEqual([200, 'application/pdf']);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="pedagogisk-mappe-[\d-]+\.pdf"$/,
      );
      expect(facts.marked).toBe(true);
      expect(facts.structure).toMatch(/^Document\(H1 .*Table\(TR\(TH TH TH\) TR\(TH TD TD\)/);
      expect(flatten(facts.outline)).toEqual(headingsOf(markdown));
      expect(facts.language).toBe('nn');
      expect(facts.title).toBe(firstTopHeading(markdown));
      expect(facts.textItems).toEqual(
        expect.arrayContaining(['Blåbærquiz for Ærlege Øvingar', 'Åtte spørsmål']),
      );
      expect(facts.imageCount).toBe(0);
      expect(facts.fonts.every((font) => font.embedded)).toBe(true);
      expect(facts.norwegianLetterFonts.length).toBeGreaterThan(0);
      expect(pdfBrowserLaunchOptions(serviceEnv()).chromiumSandbox).toBe(!runsAsRoot);
    });

    it('[MAPPE-004] has the language of the portfolio, not of the page', async () => {
      // Act
      const facts = await readTaggedPdf((await exportAs(tb, 'pdf', 'en')).body as Buffer);
      // Assert
      expect([facts.language, facts.title]).toEqual(['en', 'Teaching portfolio']);
    });

    it('[MAPPE-003] leaves no temporary file behind: only the shared browser’s profile, removed when it closes', async () => {
      // Arrange: the browser is running after the exports above
      const before = readdirSync(temporary);
      // Act
      await exportAs(tb, 'pdf');
      const after = readdirSync(temporary);
      await tb.studio.pdfRenderer.close();
      // Assert
      expect(after).toEqual(before);
      expect(before.length).toBeGreaterThan(0);
      expect(before.every((name) => name.startsWith('playwright'))).toBe(true);
      expect(readdirSync(temporary)).toEqual([]);
    });

    it('[MAPPE-004] answers 503 hvl:pdf-unavailable without a browser, and the Markdown export still works', async () => {
      // Arrange
      const caller = await missing.principal('author');
      const own = await missing.content(caller.principal.userId);
      const send = (format: string) =>
        requestAs(missing.app, caller, 'post', `/api/mappe/export?format=${format}`).send({
          contentIds: [own],
          locale: 'nn',
        });
      // Act
      const pdf = await send('pdf');
      const md = await send('md');
      // Assert
      expect([pdf.status, pdf.body.errorCode, pdf.headers['content-type']]).toEqual([
        503,
        'hvl:pdf-unavailable',
        expect.stringMatching(/^application\/json/),
      ]);
      expect(pdf.body.message).toMatch(/Last ned Markdown-fila i staden/);
      expect(md.status).toBe(200);
    });

    it('[MAPPE-004] answers 503 hvl:pdf-busy with Retry-After when every slot is taken', async () => {
      // Arrange
      const caller = await missing.principal('author');
      const own = await missing.content(caller.principal.userId);
      vi.spyOn(missing.studio.pdfRenderer, 'render').mockRejectedValueOnce(
        learningDesignError('hvl:pdf-busy'),
      );
      // Act
      const res = await requestAs(missing.app, caller, 'post', '/api/mappe/export?format=pdf').send({
        contentIds: [own],
        locale: 'nn',
      });
      // Assert
      expect([res.status, res.body.errorCode, res.headers['retry-after']]).toEqual([
        503,
        'hvl:pdf-busy',
        '10',
      ]);
      expect(res.headers['content-disposition']).toBeUndefined();
    });
  });
});
