/**
 * upstreamEntries — reads the register of H5P upstream barriers (apps/server/a11y/support/upstreamRegister.ts) with
 * the source link and any issue link of each entry, for the conformance report.
 *
 * Why: UD-040 lists known H5P upstream limitations with links to the issues. The register is the list the suite
 *      checks entry by entry (D-080), so the report reads it rather than a copy; each entry's upstream comment
 *      holds the pinned source and, once the owner has filed it (D-112), the issue.
 * Spec: UD-040, UD-030
 * Invariants:
 *   - Entries come from the module's own exports; links from the upstream comment (`// UPSTREAM` and a colon)
 *     right above each entry, in the same order, separately for `UPSTREAM_FINDINGS` and `UPSTREAM_ENGLISH_TEXTS`.
 *     Counts that differ stop the generator rather than give an entry another entry's link.
 *   - The first link of a comment is the source; a further link to `/issues/` or `/pull/` is the issue. With none,
 *     the issue is "not filed yet".
 *   - An English text concerns 3.1.2 (Language of Parts), as the register's own type says.
 * Collaborators: apps/server/a11y/support/upstreamRegister.ts, ./renderReport.mjs, ./renderCriterion.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The register, relative to the repository root. */
export const REGISTER_PATH = 'apps/server/a11y/support/upstreamRegister.ts';
/** The criterion every English library text concerns. */
export const ENGLISH_TEXT_CRITERION = '3.1.2';

/**
 * Splits the upstream comments of a part of the register into source and issue links.
 * @param {string} text - Part of the register's source.
 * @returns {{source: string, issues: string[]}[]} One per comment, in order.
 */
export function upstreamLinks(text) {
  return [...text.matchAll(/^\s*\/\/ UPSTREAM: (.*)$/gm)].map((m) => {
    const urls = [...m[1].matchAll(/https?:\/\/[^\s)]+/g)].map((u) => u[0].replace(/[.,;]$/, ''));
    return { source: urls[0] ?? '', issues: urls.slice(1).filter((u) => /\/(issues|pull)\/\d+/.test(u)) };
  });
}

/**
 * Pairs entries with the links of the comments above them.
 * @param {string} list - Which export, for the message.
 * @param {object[]} entries - The export's entries.
 * @param {{source: string, issues: string[]}[]} links - From upstreamLinks.
 * @returns {object[]} Each entry with `source` and `issues`.
 * @throws Error when the counts differ.
 */
function withLinks(list, entries, links) {
  if (entries.length !== links.length)
    throw new Error(
      `${REGISTER_PATH}: ${list} has ${entries.length} entries but ${links.length} UPSTREAM: comments`,
    );
  return entries.map((entry, i) => ({ ...entry, ...links[i] }));
}

/**
 * Reads the register.
 * @param {string} root - Repository root.
 * @returns {Promise<{findings: object[], englishTexts: object[]}>} Its two lists with links.
 */
export async function readRegister(root) {
  const file = join(root, REGISTER_PATH);
  const text = readFileSync(file, 'utf8');
  const split = text.indexOf('export const UPSTREAM_ENGLISH_TEXTS');
  if (split < 0) throw new Error(`${REGISTER_PATH} no longer exports UPSTREAM_ENGLISH_TEXTS`);
  const module = await import(pathToFileURL(file).href);
  return {
    findings: withLinks('UPSTREAM_FINDINGS', module.UPSTREAM_FINDINGS, upstreamLinks(text.slice(0, split))),
    englishTexts: withLinks(
      'UPSTREAM_ENGLISH_TEXTS',
      module.UPSTREAM_ENGLISH_TEXTS,
      upstreamLinks(text.slice(split)),
    ),
  };
}

/**
 * Says an entry's issue in words.
 * @param {{issues: string[]}} entry - A register entry with links.
 * @returns {string} The issue links, or that none is filed yet.
 */
export const issueText = (entry) =>
  entry.issues.length ? entry.issues.map((u) => `<${u}>`).join(', ') : 'not filed yet (D-112)';
