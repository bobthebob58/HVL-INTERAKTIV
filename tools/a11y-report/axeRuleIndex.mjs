/**
 * axeRuleIndex — which axe-core rules the accessibility suite runs for each WCAG success criterion, read from the
 * axe-core that @axe-core/playwright loads and from the suite's own tags.
 *
 * Why: UD-040 asks how each criterion is tested. axe tags each rule with the criteria it checks (`wcag1411` for
 *      1.4.11), so the list comes from axe itself, not from a hand-kept table that would drift with every axe update.
 * Spec: UD-040, UD-030
 * Invariants:
 *   - The tags are read from apps/server/a11y/support/axeScan.ts (`WCAG_TAGS`); the generator stops if they are gone.
 *   - A rule "runs" exactly when axe's own `ruleShouldRun` says so for those tags on a whole page: it carries one of
 *     them and none of the tags axe excludes by default (`experimental`, `deprecated`).
 *   - A rule with a criterion's tag that does not run is listed with the tag that keeps it out, so the report says
 *     what axe could check but does not.
 *   - Rules are sorted by ID; help links lose axe's `?application=` query.
 * Collaborators: axe-core (through @axe-core/playwright), ./renderCriterion.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** The file whose `WCAG_TAGS` the suite scans with. */
export const SCANNER = 'apps/server/a11y/support/axeScan.ts';

const CRITERION_TAG = /^wcag(\d)(\d)(\d+)$/;

/**
 * The criterion numbers a rule's tags name, e.g. `wcag1410` → `1.4.10`.
 * @param {string[]} tags - A rule's tags.
 * @returns {string[]} The criterion numbers.
 */
export const criteriaOfTags = (tags) =>
  tags.flatMap((tag) => {
    const m = CRITERION_TAG.exec(tag);
    return m ? [`${m[1]}.${m[2]}.${m[3]}`] : [];
  });

/**
 * Reads the tags the suite passes to axe.
 * @param {string} root - Repository root.
 * @returns {string[]} The tags, e.g. `wcag2a`.
 * @throws Error when the scanner no longer declares them.
 */
export function suiteTags(root) {
  const text = readFileSync(join(root, SCANNER), 'utf8');
  const list = /export const WCAG_TAGS = \[([^\]]*)\]/.exec(text)?.[1];
  const tags = list ? [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  if (tags.length === 0)
    throw new Error(`${SCANNER} declares no WCAG_TAGS; the report cannot say what axe runs`);
  return tags;
}

/**
 * Loads the axe-core that @axe-core/playwright, as the server workspace resolves it, injects into pages.
 * @param {string} root - Repository root.
 * @returns {object} The axe-core module.
 */
export function loadAxe(root) {
  const fromServer = createRequire(join(root, 'apps/server/package.json'));
  // WHY: the adapter exports only its entry point, so axe-core is resolved from there, as the adapter resolves it.
  const adapter = fromServer.resolve('@axe-core/playwright');
  return createRequire(adapter)('axe-core');
}

/**
 * Indexes axe's rules by criterion.
 * @param {string} root - Repository root.
 * @param {object} [axe] - The axe-core module (a test passes its own).
 * @returns {{version: string, tags: string[], rules: {id: string, help: string, helpUrl: string,
 *   criteria: string[], runs: boolean, keptOutBy?: string}[]}} Every rule that names a criterion or runs.
 */
export function axeRuleIndex(root, axe = loadAxe(root)) {
  const tags = suiteTags(root);
  const options = { runOnly: { type: 'tag', values: tags } };
  const meta = new Map(axe.getRules().map((r) => [r.ruleId, r]));
  // WHY: `_audit.tagExclude` is the list axe itself applies in matchTags; reading it keeps the reason exact.
  const excluded = axe._audit?.tagExclude ?? [];
  const rules = axe._audit.rules
    .map((rule) => {
      const runs = axe.utils.ruleShouldRun(rule, { page: true }, options);
      const keptOutBy = runs ? undefined : rule.tags.find((t) => excluded.includes(t));
      return {
        id: rule.id,
        help: meta.get(rule.id)?.help ?? rule.id,
        helpUrl: (meta.get(rule.id)?.helpUrl ?? '').replace(/\?.*$/, ''),
        criteria: criteriaOfTags(rule.tags),
        runs,
        ...(keptOutBy ? { keptOutBy } : {}),
      };
    })
    .filter((r) => r.runs || r.criteria.length > 0)
    // WHY: byte order, not localeCompare, so the order cannot depend on the machine's ICU locale data.
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { version: axe.version, tags, rules };
}

/**
 * The rules of one criterion.
 * @param {{rules: {id: string, criteria: string[], runs: boolean}[]}} index - From axeRuleIndex.
 * @param {string} id - The criterion's number.
 * @returns {{running: object[], notRunning: object[]}} The rules that run, and those with its tag that do not.
 */
export function rulesOfCriterion(index, id) {
  const all = index.rules.filter((r) => r.criteria.includes(id));
  return { running: all.filter((r) => r.runs), notRunning: all.filter((r) => !r.runs) };
}
