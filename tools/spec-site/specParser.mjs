/**
 * specParser — reads the repository's Markdown documents into plain data for the spec site.
 *
 * Why: the spec website must never drift from the Markdown specs, so it is generated from them.
 *      This module only reads and slices text; rendering lives in markdownRenderer.mjs.
 * Spec: DOC-004
 * Invariants:
 *   - Requirement headings are recognised with exactly the pattern specTrace.mjs uses, so the
 *     site and the traceability matrix always agree on what a requirement is.
 *   - Pure functions except readDocuments/readTraceStatus, which only read files.
 * Collaborators: buildSpecSite.mjs (caller), markdownRenderer.mjs (consumes slugs and docs).
 * Tests: Session 1 adds tools/spec-site/specParser.test.mjs.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** The documents shown on the site, in navigation order. `key` is the URL hash token. */
export const DOCUMENTS = [
  { key: 'spec-00', path: 'docs/specs/00-product-and-pedagogy.md', nav: '00 Product and pedagogy' },
  { key: 'spec-01', path: 'docs/specs/01-h5p-core128.md', nav: '01 H5P engine and security' },
  { key: 'spec-02', path: 'docs/specs/02-auth-feide-lti13.md', nav: '02 Feide, LTI and grades' },
  { key: 'spec-03', path: 'docs/specs/03-hvl-wcag-theme.md', nav: '03 Universal design' },
  { key: 'spec-04', path: 'docs/specs/04-laeringsdesign-page.md', nav: '04 Læringsdesign studio' },
  { key: 'spec-05', path: 'docs/specs/05-analytics-privacy.md', nav: '05 Insight and privacy' },
  { key: 'doc-standard', path: 'docs/DOCUMENTATION-STANDARD.md', nav: 'Documentation standard' },
  { key: 'evaluator-guide', path: 'docs/EVALUATOR-GUIDE.md', nav: 'Evaluator guide' },
  { key: 'decisions', path: 'docs/DECISIONS.md', nav: 'Decision log' },
  { key: 'progress', path: 'PROGRESS.md', nav: 'Build progress' },
  { key: 'reference', path: 'docs/reference/README.md', nav: 'Reference inputs' },
  { key: 'glossary', path: 'docs/GLOSSARY.md', nav: 'Glossary' },
];

/** Requirement areas by ID prefix, for the explorer's filter. */
export const AREAS = {
  PROD: 'Product', NFR: 'Non-functional', H5P: 'H5P engine', SEC: 'Upload security',
  AUTH: 'Feide login', LTI: 'Canvas LTI and grades', UD: 'Universal design', PED: 'Læringsdesign',
  MAPPE: 'Pedagogisk mappe', INS: 'Teacher insight', DATA: 'Data protection', DOC: 'Documentation',
};

// Same pattern as tools/spec-trace/specTrace.mjs: "#### SEC-001 · MUST · S2 · Title".
export const REQUIREMENT_HEADING = /^#### ([A-Z][A-Z0-9]*-\d{3}) · (MUST|SHOULD|COULD) · (S\d) · (.+)$/;

/**
 * Turns heading text into a GitHub-compatible anchor, folded to ASCII so it survives in a URL hash.
 * @param text - Raw heading text, e.g. "4. Pattern catalogue".
 * @returns e.g. "4-pattern-catalogue".
 */
export function slugify(text) {
  return text.toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 _-]/g, '').trim().replace(/ /g, '-');
}

/**
 * Reads every document in DOCUMENTS (plus README.md for the overview) from the repository.
 * @param root - Absolute path of the repository root.
 * @returns Documents with their Markdown and first-level title.
 */
export function readDocuments(root) {
  const all = [...DOCUMENTS, { key: 'readme', path: 'README.md', nav: null }];
  return all.map((doc) => {
    const markdown = readFileSync(join(root, doc.path), 'utf8');
    const title = (markdown.match(/^# (.+)$/m) ?? [, doc.nav])[1];
    return { ...doc, markdown, title };
  });
}

/**
 * Extracts every requirement block: its heading fields and the Markdown body under it.
 * A body ends at the next heading of level 1–4 or at a horizontal rule.
 * @param doc - A document from readDocuments.
 */
export function extractRequirements(doc) {
  const lines = doc.markdown.split('\n');
  const found = [];
  lines.forEach((line, i) => {
    const m = REQUIREMENT_HEADING.exec(line.trim());
    if (!m) return;
    let end = i + 1;
    while (end < lines.length && !/^#{1,4} /.test(lines[end]) && lines[end].trim() !== '---') end++;
    const [, id, priority, session, title] = m;
    found.push({ id, priority, session, title, area: id.split('-')[0], docKey: doc.key,
      body: lines.slice(i + 1, end).join('\n').trim() });
  });
  return found;
}

/**
 * Returns the Markdown under the first heading matching `pattern`, up to the next heading of the
 * same or a higher level. Returns an empty string when the heading does not exist.
 * @param markdown - A whole document.
 * @param pattern - Matched against the heading text (without the leading #'s).
 */
export function sectionUnder(markdown, pattern) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^#{1,6} /.test(l) && pattern.test(l.replace(/^#+ /, '')));
  if (start < 0) return '';
  const level = lines[start].match(/^#+/)[0].length;
  let end = start + 1;
  while (end < lines.length && !(new RegExp(`^#{1,${level}} `).test(lines[end]))) end++;
  return lines.slice(start + 1, end).join('\n').trim();
}

/**
 * Returns the first Markdown table (consecutive lines starting with "|") in `markdown`.
 * @param markdown - Any Markdown text.
 */
export function firstTable(markdown) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.startsWith('|'));
  if (start < 0) return '';
  let end = start;
  while (end < lines.length && lines[end].startsWith('|')) end++;
  return lines.slice(start, end).join('\n');
}

/**
 * Reads requirement status (planned / in code / tested) from the generated traceability matrix.
 * @param root - Absolute path of the repository root.
 * @returns Map from requirement ID to status; empty when docs/TRACEABILITY.md is missing.
 */
export function readTraceStatus(root) {
  const path = join(root, 'docs/TRACEABILITY.md');
  const status = new Map();
  if (!existsSync(path)) return status;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (/^[A-Z][A-Z0-9]*-\d{3}$/.test(cells[1] ?? '')) status.set(cells[1], cells[cells.length - 2]);
  }
  return status;
}
