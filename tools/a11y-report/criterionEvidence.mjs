/**
 * criterionEvidence — joins the evidence maps of the WCAG guidelines into one, keyed by criterion, and refuses a
 * map that misses a criterion or names one WCAG 2.2 A/AA does not have.
 *
 * Why: UD-040 lists every criterion. A criterion that drops out of the map would drop out of the report without a
 *      word, so the join is checked before anything is written.
 * Spec: UD-040
 * Invariants:
 *   - The result has exactly the keys of ./wcagCriteria.mjs CRITERIA, each with `checks` and `protocol` arrays.
 *   - Every check has `how`; a suite check also `suite` and `views`; every check names at least one ID.
 * Collaborators: ./evidencePerceivable.mjs, ./evidenceDistinguishable.mjs, ./evidenceOperable.mjs,
 *   ./evidenceNavigable.mjs, ./evidenceUnderstandableRobust.mjs,
 *   ./wcagCriteria.mjs, ./renderCriterion.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { DISTINGUISHABLE } from './evidenceDistinguishable.mjs';
import { NAVIGABLE } from './evidenceNavigable.mjs';
import { OPERABLE } from './evidenceOperable.mjs';
import { PERCEIVABLE } from './evidencePerceivable.mjs';
import { UNDERSTANDABLE_ROBUST } from './evidenceUnderstandableRobust.mjs';
import { CRITERIA } from './wcagCriteria.mjs';

/** The checks and protocol steps of every criterion, by its number. */
export const EVIDENCE = {
  ...PERCEIVABLE,
  ...DISTINGUISHABLE,
  ...OPERABLE,
  ...NAVIGABLE,
  ...UNDERSTANDABLE_ROBUST,
};

/**
 * Lists what is wrong with an evidence map: a missing or unknown criterion, or a check without its parts.
 * @param {Record<string, {checks: object[], protocol: string[]}>} evidence - Evidence by criterion number.
 * @param {{id: string}[]} [criteria] - The criteria it must cover.
 * @returns {string[]} One line per problem; empty when the map is whole.
 */
export function evidenceProblems(evidence, criteria = CRITERIA) {
  const ids = new Set(criteria.map((c) => c.id));
  const problems = [];
  for (const id of ids) if (!evidence[id]) problems.push(`criterion ${id} has no entry in the evidence map`);
  for (const [id, entry] of Object.entries(evidence)) {
    if (!ids.has(id))
      problems.push(`the evidence map names ${id}, which is not a WCAG 2.2 A or AA criterion`);
    if (!Array.isArray(entry.checks) || !Array.isArray(entry.protocol))
      problems.push(`criterion ${id} needs a checks list and a protocol list`);
    for (const check of entry.checks ?? []) {
      if (!check.how || !Array.isArray(check.match) || check.match.length === 0)
        problems.push(`a check of ${id} needs the IDs it matches and what it checks`);
      if (check.suite && !check.views)
        problems.push(`the suite check ${check.suite} of ${id} needs its views`);
    }
  }
  return problems;
}
