/**
 * markdownRenderer — renders repository Markdown to HTML for the single-page spec site.
 *
 * Why: the same Markdown must read well on GitHub and on the site. On the site, links between
 *      documents become in-page routes, requirement IDs become links to their definitions, and
 *      headings get stable anchors.
 * Spec: DOC-004
 * Invariants:
 *   - Every heading id is prefixed with its document key, so ids are unique across the page.
 *   - Requirement headings get the id "r-<ID>", matching links from anywhere on the site.
 *   - Heading levels never skip (A11Y: WCAG 1.3.1); requirement headings sit one level below
 *     the nearest preceding ordinary heading.
 * Collaborators: specParser.mjs (slugify, REQUIREMENT_HEADING), vendor/marked.esm.js (marked 12.0.2, MIT).
 * Tests: Session 1 adds tools/spec-site/markdownRenderer.test.mjs.
 */
import { posix } from 'node:path';
import { Marked } from './vendor/marked.esm.js';
import { DOCUMENTS, REQUIREMENT_HEADING, slugify } from './specParser.mjs';

const ID_ONLY = /^[A-Z][A-Z0-9]*-\d{3}$/;
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Renders a priority keyword as a badge. A11Y: the word is spelled out, never colour alone. */
export function priorityBadge(priority) {
  const word = priority[0] + priority.slice(1).toLowerCase();
  return `<span class="badge pri pri-${priority.toLowerCase()}" title="RFC 2119 ${priority}">${word}</span>`;
}

/** Renders a delivery-session badge, e.g. "Session 2". */
export function sessionBadge(session) {
  return `<span class="badge sess" title="Delivered in build session ${session.slice(1)}">${session}</span>`;
}

/**
 * Creates a renderer bound to the set of known requirement IDs and the repository's web location.
 * @param options.knownIds - Requirement IDs that exist; only these become links.
 * @param options.repoUrl - e.g. "https://github.com/owner/repo/blob/branch"; used for files the site does not show.
 * @returns `render(markdown, docKey, docPath, demote, context)` producing an HTML string; `context`
 *   names the content when it has no heading of its own (used to label tables).
 */
export function createRenderer({ knownIds, repoUrl }) {
  const routeByPath = new Map(DOCUMENTS.map((d) => [d.path, d.key]));

  /** Maps a Markdown href written inside `docPath` to an in-page route or a repository URL. */
  function resolveHref(href, docKey, docPath) {
    if (/^[a-z]+:/i.test(href)) return { href, external: true };
    if (href.startsWith('#')) return { href: `#${docKey}--${href.slice(1)}` };
    const [file, anchor] = href.split('#');
    const target = posix.normalize(posix.join(posix.dirname(docPath), file));
    const key = routeByPath.get(target);
    if (key) return { href: anchor ? `#${key}--${anchor}` : `#${key}` };
    return { href: `${repoUrl}/${target}`, external: true };
  }

  return function render(markdown, docKey, docPath, demote = 1, context = '') {
    // A11Y: map Markdown levels through a stack so a source jump ("#" straight to "###", as in
    // DECISIONS.md) never skips a level on the site (WCAG 1.3.1).
    const levels = [{ src: 1, out: 1 + demote }];
    let lastHeading = context;
    let codeCount = 0;
    let tableCount = 0;
    const marked = new Marked({ gfm: true });
    marked.use({
      renderer: {
        heading(text, level, raw) {
          const req = REQUIREMENT_HEADING.exec(`#### ${raw}`.trim());
          if (level === 4 && req) {
            const [, id, priority, session, title] = req;
            const h = Math.min(levels[levels.length - 1].out + 1, 6);
            return `<h${h} id="r-${id}" class="req-heading" tabindex="-1"><a class="req-id" href="#r-${id}">${id}</a> `
              + `${priorityBadge(priority)} ${sessionBadge(session)} <span class="req-title">${escapeHtml(title)}</span></h${h}>\n`;
          }
          while (levels.length > 1 && levels[levels.length - 1].src >= level) levels.pop();
          const out = Math.min(levels[levels.length - 1].out + 1, 6);
          levels.push({ src: level, out });
          lastHeading = raw;
          return `<h${out} id="${docKey}--${slugify(raw)}" tabindex="-1">${text}</h${out}>\n`;
        },
        link(href, title, text) {
          const target = resolveHref(href, docKey, docPath);
          if (!target.external) return `<a href="${escapeHtml(target.href)}">${text}</a>`;
          // A11Y: external links say so in text, not only with an icon (spec UD-007).
          return `<a href="${escapeHtml(target.href)}" rel="noopener" class="ext">${text}`
            + `<span aria-hidden="true"> ↗</span><span class="vh"> (opens external site)</span></a>`;
        },
        codespan(code) {
          // Requirement IDs written as `SEC-001` link to their definition.
          return ID_ONLY.test(code) && knownIds.has(code)
            ? `<a class="req-ref" href="#r-${code}"><code>${code}</code></a>` : `<code>${code}</code>`;
        },
        table(header, body) {
          // A11Y: wide tables scroll inside their own focusable region, named after the section
          // it belongs to so screen-reader users can tell regions apart (axe: landmark-unique).
          tableCount += 1;
          const label = escapeHtml(`Table ${tableCount}${lastHeading ? `, ${lastHeading}` : ''}`);
          const open = `<div class="table-wrap" role="region" aria-label="${label}" tabindex="0"><table>`;
          if (/^<tr>\n?(<th scope="col"><\/th>)+\n?<\/tr>/.test(header)) {
            // A key–value table with an empty header row: the first column labels each row.
            const rows = body.replace(/<tr>\n?<td>([\s\S]*?)<\/td>/g, '<tr><th scope="row">$1</th>');
            return `${open}<tbody>${rows}</tbody></table></div>\n`;
          }
          return `${open}<thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
        },
        tablecell(content, flags) {
          return flags.header ? `<th scope="col">${content}</th>` : `<td>${content}</td>`;
        },
        checkbox(checked) {
          // A11Y: task-list state as icon + word, not an unlabelled disabled <input> (WCAG 1.3.1, 4.1.2).
          return checked ? '<span class="task">✓ Done:</span>' : '<span class="task">○ To do:</span>';
        },
        code(code, info) {
          codeCount += 1;
          const label = escapeHtml(`Code ${codeCount}${lastHeading ? `, ${lastHeading}` : ''}`);
          return `<pre class="code" tabindex="0" role="region" aria-label="${label}"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>\n`;
        },
      },
    });
    return marked.parse(markdown);
  };
}
