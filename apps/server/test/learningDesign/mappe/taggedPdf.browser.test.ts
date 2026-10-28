/**
 * Probe P4 (D-096): Chromium prints the pedagogisk mappe as a tagged, accessible PDF on the server. pdf.js reads the
 * result back: structure tree, outline, catalog /Lang, info Title, DisplayDocTitle, real text with æøå in embedded
 * fonts. The export context has JavaScript off, is offline and aborts every request; the browser gets a scrubbed
 * environment; and Chromium's sandbox works for a normal user (not for root, which this container uses).
 *
 * Why: D-096's renderer is written from these facts; a Chromium or pdf.js upgrade that changes them fails here first.
 * Spec: MAPPE-004
 * Collaborators: ./taggedPdfDocument.ts (HTML), ./taggedPdfReader.ts (pdf.js), ./taggedPdfLaunchRunner.ts and
 *   ./taggedPdfLaunchChild.ts (sandbox and environment as another user), ../../support/browser.ts.
 * Tests: this file.
 */
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../../support/browser.js';
import {
  ISOLATION_HTML,
  PORTFOLIO_HTML,
  PORTFOLIO_TEXTS,
  PORTFOLIO_TITLE,
  REMOTE_FILES,
  SCRIPT_MARKER,
  TEN_PAGES,
  tenPageHtml,
} from './taggedPdfDocument.js';
import { NOBODY_UID, runLaunchChild, runsAsRoot } from './taggedPdfLaunchRunner.js';
import { readTaggedPdf, type TaggedPdfFacts } from './taggedPdfReader.js';

/** The environment D-096 gives the browser: nothing but PATH and HOME. */
const SCRUBBED_ENV = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };

// WHY: the sandbox and environment checks read /proc, which only Linux has.
const onLinux = process.platform === 'linux';

/** Prints HTML in a fresh export context isolated as D-096 says, and lists the requests the context aborted. */
async function printIsolated(browser: Browser, html: string): Promise<{ pdf: Buffer; aborted: string[] }> {
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
  const aborted: string[] = [];
  try {
    // SECURITY: author text ends up in this HTML; aborting every request means a crafted link or image can never
    // make the server's browser fetch anything (SSRF), and JavaScript off means nothing in it runs.
    await context.route('**/*', (route) => {
      aborted.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return { pdf: await page.pdf({ format: 'A4', tagged: true, outline: true }), aborted };
  } finally {
    await context.close();
  }
}

describeWithBrowser(
  '[MAPPE-004] a tagged PDF from Chromium on the server (probe P4, D-096)',
  (inheritingBrowser) => {
    let browser: Browser | undefined;
    let portfolio: TaggedPdfFacts;
    beforeAll(async () => {
      browser = await chromium.launch({ env: SCRUBBED_ENV });
      portfolio = await readTaggedPdf((await printIsolated(browser, PORTFOLIO_HTML)).pdf);
    });
    afterAll(() => browser?.close());

    it('[MAPPE-004] the structure tree tags headings, paragraphs, both lists, the table with header scopes and the link', () => {
      expect(portfolio.pages).toBe(1);
      // WHY: pinned as Chromium 141 tags it. <caption> and <thead> become NonStruct and <tbody> no element (no Caption,
      // THead, TBody); LI has no Lbl/LBody and "1." is untagged: residuals for the manual PAC check (D-096).
      expect(portfolio.structure).toBe(
        'Document(H1 P H2 P L(LI LI) H3 L(LI LI) Table(TR(TH TH) TR(TH TD)) P(Link) H2 P)',
      );
      expect(portfolio.headerScopes).toEqual(['Column', 'Column', 'Row']);
      expect(portfolio.dataCellHeaderCounts).toEqual([2]);
    });

    it('[MAPPE-004] the outline repeats the headings with their nesting and points at their page', () => {
      // Act and assert: beforeAll printed PORTFOLIO_HTML and read its outline (h1 > h2 > h3, all on page 1)
      expect(portfolio.outline).toEqual([
        {
          title: 'Pedagogisk mappe',
          page: 1,
          items: [
            {
              title: 'Del 1: Refleksjon over eiga undervisning',
              page: 1,
              items: [{ title: 'Studentaktiv læring', page: 1, items: [] }],
            },
            { title: 'Del 2: Vedlegg', page: 1, items: [] },
          ],
        },
      ]);
    });

    it('[MAPPE-004] the catalog has /Lang nn, the title is the <title>, and the PDF is marked as tagged', () => {
      expect(portfolio.language).toBe('nn');
      expect(portfolio.structureLanguages).toEqual(['nn']);
      expect(portfolio.title).toBe(PORTFOLIO_TITLE);
      expect(portfolio.marked).toBe(true);
      // WHY: Chromium also sets the ViewerPreferences DisplayDocTitle PDF/UA asks for, so it is no residual.
      expect(portfolio.displayDocTitle).toBe(true);
      // WHY: no XMP metadata, so no PDF/UA identifier (pdfuaid:part): a residual for the manual PAC check (D-096).
      expect(portfolio.hasXmpMetadata).toBe(false);
    });

    it('[MAPPE-004] the text is real text with æøå ÆØÅ in embedded font subsets, never an image of text', () => {
      expect(portfolio.textItems).toEqual(expect.arrayContaining([...PORTFOLIO_TEXTS]));
      expect(portfolio.imageCount).toBe(0);
      expect(portfolio.linkUrls).toEqual(['https://www.hvl.no/']);
      expect(portfolio.fonts.length).toBeGreaterThan(0);
      for (const font of portfolio.fonts) {
        expect(font, font.name).toEqual({ name: expect.stringMatching(/^[A-Z]{6}\+/), embedded: true });
      }
      expect(portfolio.norwegianLetterFonts.length).toBeGreaterThan(0);
    });

    it('[MAPPE-004] the scrubbed environment selects the same fonts as the full environment', async () => {
      // Arrange: a browser that inherits the whole test environment (the default of playwright-core)
      const inherited = await printIsolated(inheritingBrowser(), PORTFOLIO_HTML);
      // Act
      const facts = await readTaggedPdf(inherited.pdf);
      // Assert
      expect(facts.fonts.map((font) => font.name).sort()).toEqual(
        portfolio.fonts.map((font) => font.name).sort(),
      );
      expect(facts.norwegianLetterFonts).toEqual(portfolio.norwegianLetterFonts);
    });

    it('[MAPPE-004] the export context aborts every remote request and runs no script', async () => {
      // Act
      const { pdf, aborted } = await printIsolated(browser!, ISOLATION_HTML);
      const facts = await readTaggedPdf(pdf);
      // Assert
      expect(aborted.sort()).toEqual([...REMOTE_FILES].sort());
      expect(facts.textItems).toContain('Berre denne teksten.');
      expect(facts.textItems.join(' ')).not.toContain(SCRIPT_MARKER);
    });

    it('[MAPPE-004] a ten-page portfolio prints in well under the export time limit with an outline per chapter', async () => {
      // Arrange
      const started = performance.now();
      // Act
      const { pdf } = await printIsolated(browser!, tenPageHtml());
      const elapsed = performance.now() - started;
      const facts = await readTaggedPdf(pdf);
      // Assert
      expect(facts.pages).toBe(TEN_PAGES);
      expect(facts.outline[0]?.items.map((chapter) => chapter.page)).toEqual(
        Array.from({ length: TEN_PAGES }, (_, index) => index + 1),
      );
      // WHY: observed 50-100 ms here (context, setContent and pdf); 10 s leaves room for a loaded CI runner and is
      // still below any time limit D-096 would set for one export.
      expect(elapsed).toBeLessThan(10_000);
    });

    it.runIf(onLinux && runsAsRoot)('[MAPPE-004] as root, Chromium refuses to start with its sandbox', () => {
      const report = runLaunchChild({ sandbox: true, scrubbed: true, asNobody: false });
      expect(report.launched).toBe(false);
      expect(report.launched ? '' : report.error).toMatch(
        /Running as root without --no-sandbox is not supported/,
      );
    });

    it.runIf(onLinux)(
      '[MAPPE-004] as a normal user, the sandboxed browser with a scrubbed environment prints a PDF',
      () => {
        // Act: as `nobody` when the test runs as root, else as the test's own user
        const report = runLaunchChild({ sandbox: true, scrubbed: true, asNobody: runsAsRoot });
        // Assert: the renderer runs under seccomp-BPF in its own user namespace, and no secret reached any process
        expect(report).toMatchObject({
          launched: true,
          uid: runsAsRoot ? NOBODY_UID : process.getuid?.(),
          pdfHeader: '%PDF-',
          noSandboxFlag: false,
          canaryVisible: false,
        });
        if (!report.launched) return;
        expect(report.seccompFiltered).toBeGreaterThanOrEqual(1);
        expect(report.ownUserNamespace).toBeGreaterThanOrEqual(1);
        // WHY: Chromium adds PWD itself (observed); it names the working directory, not a secret. HOME and PATH must
        // be listed, which proves the browser's environment was readable, so `canaryVisible: false` means something.
        expect(report.browserEnvironment.filter((name) => name !== 'PWD')).toEqual(['HOME', 'PATH']);
      },
    );

    it.runIf(onLinux)(
      '[MAPPE-004] without `env` and the sandbox, the browser inherits every secret and runs unconfined',
      () => {
        // Act: the playwright-core defaults that browser.ts uses for tests
        const report = runLaunchChild({ sandbox: false, scrubbed: false, asNobody: false });
        // Assert
        expect(report).toMatchObject({
          launched: true,
          noSandboxFlag: true,
          seccompFiltered: 0,
          canaryVisible: true,
        });
      },
    );
  },
);
