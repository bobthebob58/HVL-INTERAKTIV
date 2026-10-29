/**
 * Browser test of the PDF renderer's export context with a real Chromium (D-096): a document that names a local
 * listener in an image, a stylesheet, an `@import`, a background and a frame makes an ordinary page fetch them, but
 * not an export through `PdfRenderer.render`, whose context aborts every request. The frame matters most: `offline`
 * alone does not stop a frame's navigation, so the abort is the only thing that keeps it from the network (SSRF).
 *
 * Spec: MAPPE-004
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PdfRenderer } from '../../../src/learningDesign/mappe/pdf/PdfRenderer.js';
import { createLogger } from '../../../src/logging/logger.js';
import { describeWithBrowser } from '../../support/browser.js';
import { runsAsRoot } from './taggedPdfLaunchRunner.js';

/** A document whose every remote part points at `origin`. */
const remoteDocument = (origin: string) =>
  [
    '<!doctype html><html lang="nn"><head><meta charset="utf-8"><title>Isolasjon</title>',
    `<link rel="stylesheet" href="${origin}/style">`,
    `<style>@import url("${origin}/import"); body { background: url("${origin}/background"); }</style>`,
    '</head><body><h1>Isolasjon</h1>',
    `<p><img src="${origin}/image" alt="Bilete"></p>`,
    `<iframe src="${origin}/frame" title="Ramme"></iframe>`,
    `<p><a href="${origin}/link">Lenke</a></p>`,
    '</body></html>',
  ].join('');

describeWithBrowser('[MAPPE-004] the PDF renderer’s export context in a real Chromium', (browser) => {
  const hits: string[] = [];
  let listener: Server;
  let origin: string;
  let renderer: PdfRenderer;

  beforeAll(async () => {
    listener = createServer((req, res) => {
      hits.push(req.url ?? '');
      res.end();
    });
    await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
    // WHY: root cannot use Chromium's sandbox; the non-root CI runner keeps it (D-096 contracts amendment).
    renderer = new PdfRenderer({
      env: { PDF_ALLOW_NO_SANDBOX: runsAsRoot, PDF_MAX_CONCURRENCY: 2 },
      logger: createLogger({ level: 'silent' }),
    });
  });
  afterAll(async () => {
    await renderer?.close();
    await new Promise((resolve) => listener?.close(resolve));
  });

  it('[MAPPE-004] aborts every request: no stylesheet, image or frame of the document reaches a local listener', async () => {
    // Arrange: an ordinary page shows that the document does make these requests
    const page = await browser().newPage();
    await page.setContent(remoteDocument(origin), { waitUntil: 'load' });
    await page.close();
    const ordinary = hits.splice(0);
    // Act
    const pdf = await renderer.render(remoteDocument(origin), 'kari');
    // Assert
    expect(ordinary).toEqual(expect.arrayContaining(['/style', '/image', '/frame']));
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(hits).toEqual([]);
  });
});
