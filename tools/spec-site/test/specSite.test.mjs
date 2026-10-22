/**
 * Tests for the spec website: requirement extraction, link rendering and a deterministic, landmarked page.
 *
 * Spec: DOC-004
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DOCUMENTS, extractRequirements, readDocuments, slugify } from '../specParser.mjs';
import { createRenderer } from '../markdownRenderer.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const BUILD = fileURLToPath(new URL('../buildSpecSite.mjs', import.meta.url));
const REPO = 'https://github.com/bobthebob58/HVL-INTERAKTIV/blob/HEAD';

describe('[DOC-004] spec website', () => {
  it('[DOC-004] extracts every requirement once, with priority and session', () => {
    const requirements = readDocuments(ROOT).flatMap(extractRequirements);
    const trace = readFileSync(`${ROOT}docs/TRACEABILITY.md`, 'utf8');
    const traced = [...trace.matchAll(/^\| ([A-Z][A-Z0-9]*-\d{3}) \|/gm)].map((m) => m[1]);
    expect(requirements.map((r) => r.id).sort()).toEqual([...traced].sort());
    expect(new Set(requirements.map((r) => r.id)).size).toBe(requirements.length);
    for (const r of requirements) expect(r.session, r.id).toMatch(/^S\d$/);
  });

  it('[DOC-004] makes stable anchors from headings', () => {
    expect(slugify('H5P-001 · MUST · S1 · Target Core API 1.28')).toBe(
      slugify('H5P-001 · MUST · S1 · Target Core API 1.28'),
    );
    expect(slugify('Læringsdesign & mappe')).toMatch(/^[a-z0-9-]+$/);
  });

  it('[DOC-004] links known requirement IDs in-page and other repository files to GitHub', () => {
    const render = createRenderer({ knownIds: new Set(['SEC-001']), repoUrl: REPO });
    const spec01 = DOCUMENTS.find((d) => d.path.endsWith('01-h5p-core128.md'));
    const html = render(
      'See `SEC-001` and [the code](../../apps/server/src/h5p/H5pConfigFactory.ts).',
      spec01.key,
      spec01.path,
    );
    expect(html).toContain('<a class="req-ref" href="#r-SEC-001"><code>SEC-001</code></a>');
    expect(html).toContain(`${REPO}/apps/server/src/h5p/H5pConfigFactory.ts`);
  });

  it('[DOC-004] the committed page is up to date, does not depend on the checkout and has its landmarks', () => {
    const check = spawnSync(process.execPath, [BUILD, '--check'], { encoding: 'utf8' });
    expect(check.status, check.stderr).toBe(0);
    const html = readFileSync(`${ROOT}docs/site/index.html`, 'utf8');
    for (const landmark of [
      '<header class="masthead">',
      '<nav class="sidenav"',
      '<main id="main"',
      '<footer',
    ]) {
      expect(html).toContain(landmark);
    }
    expect(html).toMatch(/<html lang="en"/);
    const branches = new Set([...html.matchAll(/HVL-INTERAKTIV\/blob\/([^/"]+)/g)].map((m) => m[1]));
    expect([...branches]).toEqual(['HEAD']);
  });
});
