/**
 * pageTemplate — assembles the spec site's HTML from rendered parts.
 *
 * Why: keeps page structure (landmarks, navigation, views) separate from data extraction and
 *      Markdown rendering, so each file stays small and reviewable.
 * Spec: DOC-004
 * Invariants:
 *   - Without JavaScript every view is visible, stacked in navigation order (progressive enhancement).
 *   - One <h1> for the page; each view starts with an <h2> (A11Y: WCAG 1.3.1, 2.4.6).
 *   - No colour-only meaning: badges and statuses carry words (A11Y: WCAG 1.4.1).
 * Collaborators: buildSpecSite.mjs (caller), markdownRenderer.mjs (badges).
 * Tests: Session 1 adds a snapshot test of the rendered landmarks.
 */
import { AREAS } from './specParser.mjs';
import { priorityBadge, sessionBadge } from './markdownRenderer.mjs';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const STATUS_WORD = { planned: '○ Planned', 'in code': '◐ In code', tested: '● Tested' };

/** Builds a <select> filter with an "All" option. */
function select(id, label, options) {
  const opts = options.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join('');
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}"><option value="">All</option>${opts}</select></div>`;
}

/** Renders one requirement as an expandable card for the explorer. */
function requirementCard(r) {
  const status = r.status ?? 'planned';
  const text = `${r.id} ${r.title} ${r.body}`.toLowerCase();
  return `<details class="req" id="x-${r.id}" data-area="${r.area}" data-priority="${r.priority}" data-session="${r.session}" data-status="${esc(status)}" data-text="${esc(text)}">
<summary><span class="req-id">${r.id}</span> ${priorityBadge(r.priority)} ${sessionBadge(r.session)} <span class="req-title">${esc(r.title)}</span> <span class="status" data-status="${esc(status)}">${esc(STATUS_WORD[status] ?? status)}</span></summary>
<div class="req-body">${r.html}<p class="req-source">Defined in <a href="#r-${r.id}">${esc(r.docNav)}, ${r.id}</a> · ${esc(AREAS[r.area] ?? r.area)}</p></div>
</details>`;
}

/** The requirement explorer view: filters, live result count, and every requirement card. */
export function explorerView(requirements) {
  const areas = Object.entries(AREAS).filter(([k]) => requirements.some((r) => r.area === k));
  const sessions = [...new Set(requirements.map((r) => r.session))]
    .sort()
    .map((s) => [s, `Session ${s.slice(1)}`]);
  return `<section class="view" id="requirements" aria-labelledby="requirements-h">
<h2 id="requirements-h" tabindex="-1">Requirements</h2>
<p class="lede">Every requirement in the specification, with its acceptance criteria and how it will be verified. Filter by area, priority, build session or status, or search the text. Click an ID anywhere on this site to jump to its definition.</p>
<form class="filters" id="req-filters" role="search" aria-label="Filter requirements">
<div class="field field-search"><label for="req-search">Search</label><input id="req-search" type="search" autocomplete="off" placeholder="e.g. ltik, SVG, k-suppression"></div>
${select('req-area', 'Area', areas)}
${select('req-priority', 'Priority', [
  ['MUST', 'Must'],
  ['SHOULD', 'Should'],
  ['COULD', 'Could'],
])}
${select('req-session', 'Session', sessions)}
${select('req-status', 'Status', [
  ['planned', 'Planned'],
  ['in code', 'In code'],
  ['tested', 'Tested'],
])}
<div class="field field-actions"><button type="button" id="req-expand">Expand all</button><button type="reset" id="req-reset">Clear filters</button></div>
</form>
<p class="result-count" id="req-count" aria-live="polite">Showing all ${requirements.length} requirements.</p>
<div class="req-list">${requirements.map(requirementCard).join('\n')}</div>
</section>`;
}

/** A rendered Markdown document as a view. */
export function documentView(doc) {
  return `<section class="view doc" id="${doc.key}" aria-labelledby="${doc.key}-h">
<h2 id="${doc.key}-h" tabindex="-1">${esc(doc.title)}</h2>
${doc.html}
</section>`;
}

/** The whole page fragment (the publish skeleton or `wrapDocument` supplies <html>/<head>/<body>). */
export function page({ css, js, nav, overview, explorer, documents }) {
  const links = nav
    .map(
      (group) =>
        `<li class="nav-group"><span class="nav-group-label">${esc(group.label)}</span><ul>${group.items
          .map((i) => `<li><a href="#${i.key}" data-view="${i.key}">${esc(i.text)}</a></li>`)
          .join('')}</ul></li>`,
    )
    .join('');
  return `<title>HVL Interaktiv Spec</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Specification for HVL Interaktiv: accessible, research-based H5P activities for asynchronous learning at Høgskulen på Vestlandet.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,600&display=swap">
<style>${css}</style>
<a class="skip" href="#main">Skip to content</a>
<div class="shell">
<header class="masthead">
<p class="kicker">Høgskulen på Vestlandet · Specification v1.0</p>
<h1>HVL Interaktiv</h1>
<p class="tagline">Short, accessible, interactive activities for asynchronous study, with feedback to teachers before the next class.</p>
</header>
<nav class="sidenav" aria-label="Specification contents"><details class="nav-toggle" open><summary>Contents</summary><ul class="nav-root">${links}</ul></details></nav>
<main id="main" tabindex="-1">
${overview}
${explorer}
${documents.join('\n')}
</main>
<footer class="foot"><p>Generated from the Markdown in this repository by <code>tools/spec-site/buildSpecSite.mjs</code>. The Markdown files are the source of truth; this page is a reading aid. Licensed GPL-3.0-or-later.</p></footer>
</div>
<script>${js}</script>`;
}

/** Wraps a fragment in a full HTML document for local viewing (the Artifact publish adds its own). */
export function wrapDocument(fragment) {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${fragment}\n</body>\n</html>\n`;
}
