/**
 * overviewView — the spec site's landing view, assembled from sections of the real documents.
 *
 * Why: the first screen should answer "what is this, for whom, and how far along is it?"
 *      without anyone hand-copying numbers that could go stale. Every table and count shown
 *      here is extracted from the Markdown at build time.
 * Spec: DOC-004
 * Invariants:
 *   - No figure is typed by hand: counts come from parsed requirements and tables.
 *   - Each block links to the document it was taken from.
 * Collaborators: buildSpecSite.mjs (caller), specParser.mjs (sectionUnder, firstTable).
 * Tests: Session 1 adds a test that every extracted block is non-empty.
 */
import { sectionUnder, firstTable } from './specParser.mjs';

/** Counts body rows of a Markdown table (excludes header and separator). */
const tableRows = (table) => Math.max(0, table.split('\n').filter((l) => l.startsWith('|')).length - 2);

/**
 * Builds the overview <section>.
 * @param docs - Map from document key to document (with markdown).
 * @param requirements - Parsed requirements.
 * @param render - Bound Markdown renderer from markdownRenderer.mjs.
 * @returns HTML string.
 */
export function overviewView(docs, requirements, render) {
  const md = (key) => docs.get(key).markdown;
  const block = (markdown, key, label = '') => render(markdown, key, docs.get(key).path, 2, label);
  const byPriority = (p) => requirements.filter((r) => r.priority === p).length;

  const promise = sectionUnder(md('spec-00'), /^1\.2 Product promise/).replace(/^> ?/gm, '');
  const offer = firstTable(sectionUnder(md('readme'), /^What it does/));
  const phases = firstTable(sectionUnder(md('spec-04'), /^3\. Phase matrix/));
  const contentTypes = tableRows(firstTable(sectionUnder(md('spec-01'), /^3\. The ten content types/)));
  const patterns = tableRows(firstTable(sectionUnder(md('spec-04'), /^4\. Pattern catalogue/)));
  const sessions = firstTable(sectionUnder(md('progress'), /^Status overview/));
  const sessionCount = tableRows(sessions) - 1; // S0 is the specification itself
  const done = (sessions.match(/✅/g) ?? []).length - 1; // S0 (the specification) is not a build session
  const decisions = firstTable(md('decisions'));
  const references = firstTable(md('reference'));

  return `<section class="view" id="overview" aria-labelledby="overview-h">
<h2 id="overview-h" tabindex="-1">Overview</h2>
<div class="promise">${block(promise, 'spec-00')}</div>
<dl class="glance">
<div><dt>Requirements</dt><dd><a href="#requirements">${requirements.length}</a> <span class="sub">${byPriority('MUST')} must · ${byPriority('SHOULD')} should · ${byPriority('COULD')} could</span></dd></div>
<div><dt>Build sessions</dt><dd>${sessionCount} <span class="sub">${Math.max(0, done)} of ${sessionCount} done; specification complete</span></dd></div>
<div><dt>H5P content types</dt><dd>${contentTypes} <span class="sub">chosen for pedagogy and accessibility</span></dd></div>
<div><dt>Learning-design patterns</dt><dd>${patterns} <span class="sub">for forarbeid, mellomarbeid and etterarbeid</span></dd></div>
</dl>
<h3 id="overview--offer" tabindex="-1">What it does for teachers and students</h3>
${block(offer, 'readme', 'What it does')}
<h3 id="overview--phases" tabindex="-1">How asynchronous work fits around the seminar</h3>
<p>HVL Interaktiv supports the asynchronous phases of a course. The synchronous session (<em>samling</em>) happens in the classroom or online; the activities prepare for it and consolidate after it.</p>
${block(phases, 'spec-04', 'Phase matrix')}
<p class="more"><a href="#spec-04">Read the læringsdesign spec</a> · <a href="#spec-00--4-design-principles-and-the-pedagogy-behind-them">See the research behind each principle</a></p>
<h3 id="overview--plan" tabindex="-1">Build plan</h3>
${block(sessions, 'progress', 'Build plan')}
<p class="more"><a href="#progress">Open the build tracker</a> · <a href="#evaluator-guide--5-session-gates">See each session's pass/fail gate</a></p>
<h3 id="overview--decisions" tabindex="-1">Key decisions, including corrections to the original plan</h3>
${block(decisions, 'decisions', 'Key decisions')}
<h3 id="overview--references" tabindex="-1">Reference inputs from HVL</h3>
${block(references, 'reference', 'Reference inputs')}
<h3 id="overview--howto" tabindex="-1">How to read this site</h3>
<ul>
<li><strong>Teachers and learning designers:</strong> start with <a href="#spec-00">00 Product and pedagogy</a>, then <a href="#spec-04">04 Læringsdesign studio</a>.</li>
<li><strong>Evaluators and reviewers:</strong> read the <a href="#evaluator-guide">Evaluator guide</a>, then use <a href="#requirements">Requirements</a> to check any promise against its acceptance criteria.</li>
<li><strong>Developers:</strong> the <a href="#doc-standard">Documentation standard</a> says how every file must explain itself.</li>
<li>Norwegian terms are explained in the <a href="#glossary">Glossary</a>.</li>
</ul>
</section>`;
}
