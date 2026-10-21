/**
 * buildSpecSite — generates a single-file, readable website of the whole specification.
 *
 * Why: evaluators, teachers and ALU staff should be able to read and search the specification
 *      without a Git client. Generating the page from the Markdown keeps one source of truth.
 * Spec: DOC-004
 * Invariants:
 *   - Uses only Node built-ins plus the vendored marked 12.0.2 (MIT), so it runs before
 *     `npm install`. Session 1 may replace the vendored copy with a pinned devDependency.
 *   - Deterministic: the same repository content produces byte-identical output.
 * Collaborators: specParser.mjs, markdownRenderer.mjs, overviewView.mjs, pageTemplate.mjs,
 *   spec-site.base.css, spec-site.components.css, spec-site.client.js.
 * Tests: Session 1 adds tools/spec-site/buildSpecSite.test.mjs (runs a build and checks landmarks).
 *
 * Usage:
 *   node tools/spec-site/buildSpecSite.mjs                      write docs/site/index.html
 *   node tools/spec-site/buildSpecSite.mjs --fragment <path>    also write the page body only
 *                                                               (for publishing as a Claude Artifact)
 *   node tools/spec-site/buildSpecSite.mjs --check              fail if docs/site/index.html is stale
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DOCUMENTS, readDocuments, extractRequirements, readTraceStatus } from './specParser.mjs';
import { createRenderer } from './markdownRenderer.mjs';
import { overviewView } from './overviewView.mjs';
import { explorerView, documentView, page, wrapDocument } from './pageTemplate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const OUTPUT = 'docs/site/index.html';
const FALLBACK_REPO_URL = 'https://github.com/bobthebob58/HVL-INTERAKTIV/blob/main';

/** Builds the GitHub "blob" base URL for files the site links to but does not display. */
function repoBlobUrl() {
  try {
    const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' }).trim();
    const remote = git('remote', 'get-url', 'origin')
      .replace(/\.git$/, '')
      .replace(/^git@github\.com:/, 'https://github.com/');
    // WHY: strip credentials a proxy may have injected into the remote URL.
    const clean = remote
      .replace(/^https:\/\/[^@/]+@/, 'https://')
      .replace(/^http:\/\/[^/]+\/git\//, 'https://github.com/');
    return `${clean}/blob/${git('rev-parse', '--abbrev-ref', 'HEAD')}`;
  } catch {
    return FALLBACK_REPO_URL;
  }
}

/** Groups navigation links: getting started, the six specs, and reviewer material. */
function navigation() {
  const item = (d) => ({ key: d.key, text: d.nav });
  return [
    {
      label: 'Start here',
      items: [
        { key: 'overview', text: 'Overview' },
        { key: 'requirements', text: 'Requirements' },
      ],
    },
    { label: 'Specifications', items: DOCUMENTS.filter((d) => d.key.startsWith('spec-')).map(item) },
    { label: 'For reviewers', items: DOCUMENTS.filter((d) => !d.key.startsWith('spec-')).map(item) },
  ];
}

function main() {
  const args = process.argv.slice(2);
  const fragmentPath = args.includes('--fragment') ? args[args.indexOf('--fragment') + 1] : null;
  const docs = new Map(readDocuments(ROOT).map((d) => [d.key, d]));
  const status = readTraceStatus(ROOT);
  const requirements = DOCUMENTS.flatMap((d) => extractRequirements(docs.get(d.key))).map((r) => ({
    ...r,
    status: status.get(r.id),
    docNav: docs.get(r.docKey).nav,
  }));
  const render = createRenderer({ knownIds: new Set(requirements.map((r) => r.id)), repoUrl: repoBlobUrl() });

  for (const r of requirements)
    r.html = render(r.body, r.docKey, docs.get(r.docKey).path, 3, `${r.id} ${r.title}`);
  const documents = DOCUMENTS.map((d) => {
    const doc = docs.get(d.key);
    const body = doc.markdown.replace(/^# .+\n/m, ''); // the view's own <h2> carries the title
    return documentView({ ...doc, html: render(body, d.key, d.path, 1, `${d.nav} details`) });
  });

  const css = ['spec-site.base.css', 'spec-site.components.css']
    .map((f) => readFileSync(join(HERE, f), 'utf8'))
    .join('\n');
  const js = readFileSync(join(HERE, 'spec-site.client.js'), 'utf8');
  const fragment = page({
    css,
    js,
    nav: navigation(),
    overview: overviewView(docs, requirements, render),
    explorer: explorerView(requirements),
    documents,
  });
  const html = wrapDocument(fragment);

  if (args.includes('--check')) {
    const current = existsSync(join(ROOT, OUTPUT)) ? readFileSync(join(ROOT, OUTPUT), 'utf8') : '';
    if (current !== html) {
      console.error(`✗ ${OUTPUT} is out of date; run node tools/spec-site/buildSpecSite.mjs`);
      process.exit(1);
    }
    console.log(`✓ ${OUTPUT} is up to date.`);
    return;
  }
  mkdirSync(join(ROOT, dirname(OUTPUT)), { recursive: true });
  writeFileSync(join(ROOT, OUTPUT), html);
  console.log(
    `Wrote ${OUTPUT} (${(html.length / 1024).toFixed(0)} KB, ${requirements.length} requirements, ${DOCUMENTS.length} documents).`,
  );
  if (fragmentPath) {
    writeFileSync(fragmentPath, fragment);
    console.log(`Wrote fragment ${fragmentPath}.`);
  }
}

main();
