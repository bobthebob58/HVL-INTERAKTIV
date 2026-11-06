/**
 * End-to-end test of journey J5's first step (spec 00 §3, «Govern the platform»), in full Chromium: Kari at ALU edits
 * a pattern's guidance text in a copy of the studio's content files, as a pull request would change them, and nothing
 * else. `npm run content:check` accepts the copy, and the server started on it shows the new text on the pattern's
 * public page (PED-011): no code changes. An edit that breaks the file (the Bokmål text removed) is refused by the
 * same command with the file's path, before any server would start on it (D-082).
 * J5's second step (library installs by administrators only, even through an uploaded `.h5p`, H5P-006 and SEC-003) is
 * proved over HTTP by ../test/http/packageImport.int.test.ts and ../test/http/ajax.int.test.ts; installing a version
 * in staging and promoting it to production is the procedure «A new content-type version» in docs/ops/runbook.md §2,
 * which no test runs (D-101's amendment of 2026-11-05, S6 step 8).
 * The whole server with the built web app (../test/support/appTestbed.ts) and no content types: the page needs none.
 *
 * Spec: PED-011, PED-001
 */
import { execFile } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { STUDIO_CONTENT_ROOT, loadStudioContent } from '../src/learningDesign/content/loadStudioContent.js';
import { loadWebApp, type WebApp } from '../src/web/nextWebApp.js';
import { openAppTestbed, type AppTestbed } from '../test/support/appTestbed.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { SERVER_DIR } from '../test/support/serverCli.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';

const PATTERN = 'fa-video';
const PATTERN_FILE = join('laeringsdesign', 'patterns', PATTERN, 'pattern.yaml');
const EDITED =
  'Ein kort video med tre kontrollspørsmål og ei oppsummering, så studenten hentar fram kva videoen viste.';

/** Runs `npm run content:check -- --root=<folder>` from apps/server, as Kari or CI would. */
async function contentCheck(root: string): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await promisify(execFile)(
      'npm',
      ['run', '--silent', 'content:check', '--', `--root=${root}`],
      {
        cwd: SERVER_DIR,
        env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
      },
    );
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, output: `${failed.stdout ?? ''}${failed.stderr ?? ''}` };
  }
}

/** Changes one value of a content file's YAML, keeping its comments and the rest of the file. */
function editYaml(file: string, edit: (document: ReturnType<typeof parseDocument>) => void): void {
  const document = parseDocument(readFileSync(file, 'utf8'));
  edit(document);
  writeFileSync(file, document.toString());
}

describeWithRealWebApp('[PED-011] ALU changes a pattern’s guidance in the content files alone (J5)', () => {
  let browser: Browser;
  let web: WebApp;
  let tb: AppTestbed;
  const copies: string[] = [];
  /** A copy of the repository's content folder, as a pull request's branch holds it. */
  const contentCopy = (): string => {
    const root = mkdtempSync(join(tmpdir(), 'hvli-content-'));
    cpSync(STUDIO_CONTENT_ROOT, root, { recursive: true });
    copies.push(root);
    return root;
  };
  beforeAll(async () => {
    browser = await launchCookieTestChromium();
    web = await loadWebApp('prod');
  }, 120_000);
  afterAll(async () => {
    await tb?.close();
    await web?.close();
    await browser?.close();
    for (const root of copies) rmSync(root, { recursive: true, force: true });
  });

  it('[PED-011] the edited text passes content:check and shows on the pattern page; a broken edit is refused', async () => {
    // Arrange: Kari's edit, and a broken one, each in its own copy of content/
    const edited = contentCopy();
    editYaml(join(edited, PATTERN_FILE), (document) => document.setIn(['purpose', 'nn'], EDITED));
    const broken = contentCopy();
    editYaml(join(broken, PATTERN_FILE), (document) => document.deleteIn(['purpose', 'nb']));
    // Act: the check Kari's pull request runs
    const accepted = await contentCheck(edited);
    const refused = await contentCheck(broken);
    // Act: the server starts on the edited content, and the pattern's page opens in the browser
    tb = await openAppTestbed([], { web, studioContent: loadStudioContent(edited) });
    const page = await (await browser.newContext()).newPage();
    const flow = await recordFlow(page, tb.toolUrl, {
      // WHY: Chromium logs each failed resource; the tool's are in `flow.failed`, asserted below, and the web app has
      // no icon yet, so a visitor's first page logs a 404 for /favicon.ico.
      ignoreConsole: (m) => m.text().startsWith('Failed to load resource'),
    });
    const shown = await flow.run(async () => {
      flow.step = 'pattern page';
      await page.goto(`${tb.toolUrl}/laeringsdesign/monster/${PATTERN}`);
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });
      return (await page.locator('main').textContent()) ?? '';
    });
    // Assert: the edit alone passes the check, and the page shows it
    expect(accepted.code).toBe(0);
    expect(accepted.output).toContain('✓ content:check');
    expect(shown).toContain(EDITED);
    // Assert: the broken edit is refused with the file it is in, so it never reaches a server
    expect(refused.code).toBe(1);
    expect(refused.output).toContain(PATTERN_FILE.split('/').slice(-2).join('/'));
    // WHY: the public page asks whether someone is signed in; a visitor's two answers are 401, and nothing else fails.
    expect([...flow.failed].sort()).toEqual(['401 /api/me', '401 /auth/session']);
    expect(flow.problems).toEqual([]);
    await page.context().close();
  }, 180_000);
});
