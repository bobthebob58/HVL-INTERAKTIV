/**
 * mappeActivityView — one selected activity as the pedagogisk mappe template sees it (`{{#aktivitetar}}`): every item
 * value as text in the portfolio's language, with a localised placeholder where something is not known.
 *
 * Why: D-094 (probe P5 amendment) wants every key present on every list item, so a missing field never falls back
 *      to the parent's field of the same name, and no value empty, since an empty value can turn the template's own
 *      `**…**` into a rule or `## …` into an empty heading. The texts are the activity's own, the content's phase
 *      label (PED-001) and the server's locale texts; the Markdown escaper is applied by Mustache, not here.
 * Spec: MAPPE-002, MAPPE-003, PED-001
 * Invariants:
 *   - Builds exactly the keys of `MappeActivityView` (../mappe/mappeVariables.ts); the compiler checks the set.
 *   - PRIVACY: the results are the aggregates of ./activityResults.ts only, never a learner's value (MAPPE-003), and
 *     they are labelled formative (CLAUDE.md §1: H5P scores are never exam evidence).
 *   - Pure: no database, clock or network.
 * Collaborators: ./mappeView.ts (the caller), ./mappeActivitySource.ts, ./mappeFindings.ts, ./activityResults.ts,
 *   ./mappeFormat.ts, ../../i18n/translate.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappeView.test.ts
 */
import { AUTHORABLE_CONTENT_TYPES, type LearningOutcome } from '@hvl-interaktiv/api-contract';
import { t, type MessageKey } from '../../i18n/translate.js';
import type { ActivityAggregates } from './activityResults.js';
import type { MappeSourceActivity } from './mappeActivitySource.js';
import type { MappeFinding } from './mappeFindings.js';
import type { MappeFormat } from './mappeFormat.js';
import type { MappeActivityView, MappeFindingView } from './mappeVariables.js';

/** What one activity's view is built from. */
export interface MappeActivityInputs {
  readonly activity: MappeSourceActivity;
  readonly findings: readonly MappeFinding[];
  readonly aggregates: ActivityAggregates;
  /** The phase's label from the content in the portfolio's language, when the activity has a phase. */
  readonly phaseLabel?: string;
  /** The activity's page in the portal. */
  readonly link: string;
  /** The minimum group size *k*. */
  readonly k: number;
}

type Say = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * A text, or a placeholder when it is blank.
 * @param value - The text, if any.
 * @param placeholder - What to write instead.
 * @returns The trimmed text, or the placeholder.
 */
export const orPlaceholder = (value: string | undefined, placeholder: string): string =>
  value?.trim() ? value.trim() : placeholder;

const contentTypeName = (mainLibrary: string, say: Say): string =>
  (AUTHORABLE_CONTENT_TYPES as readonly string[]).includes(mainLibrary)
    ? say(`mappe.contentType.${mainLibrary.slice('H5P.'.length)}` as MessageKey)
    : mainLibrary;

const outcomesText = (outcomes: readonly LearningOutcome[], say: Say): string =>
  outcomes
    .map((outcome) =>
      say('mappe.outcome', {
        text: outcome.text,
        category: say(`mappe.outcomeCategory.${outcome.category}` as MessageKey),
      }),
    )
    .join('; ');

const findingView = (finding: MappeFinding, format: MappeFormat, say: Say): MappeFindingView => ({
  alvor: say(`mappe.findings.${finding.severity}` as MessageKey),
  melding: finding.message,
  uu_grunngjeving: finding.acknowledgement
    ? say('mappe.findings.acknowledged', {
        date: format.date(finding.acknowledgement.at),
        reason: finding.acknowledgement.reason,
      })
    : say(finding.severity === 'error' ? 'mappe.findings.notAcknowledged' : 'mappe.findings.noReasonNeeded'),
});

const findingsSummary = (findings: readonly MappeFinding[], format: MappeFormat, say: Say): string => {
  if (findings.length === 0) return say('mappe.findings.none');
  const errors = findings.filter((finding) => finding.severity === 'error');
  return say('mappe.findings.summary', {
    errors: format.number(errors.length),
    acknowledged: format.number(errors.filter((finding) => finding.acknowledgement).length),
    warnings: format.number(findings.filter((finding) => finding.severity === 'warning').length),
  });
};

/** The result figures: each shown, hidden below *k*, or not recorded yet. */
function resultFigures(aggregates: ActivityAggregates, format: MappeFormat, say: Say, k: number) {
  const missing = say(aggregates.recorded ? 'mappe.results.hidden' : 'mappe.results.notRecorded');
  const shown = <T>(value: T | undefined, write: (value: T) => string) =>
    value === undefined ? missing : write(value);
  const figures = {
    deltakarar: shown(aggregates.participants, format.number),
    fullforing: shown(aggregates.completionRate, format.percent),
    median_forsok: shown(aggregates.medianAttempts, format.number),
    endring: shown(aggregates.changePoints, (value) =>
      say('mappe.results.points', { value: format.signed(value) }),
    ),
  };
  // PRIVACY: a group under k gets one sentence and no figure at all (MAPPE-003).
  let resultat: string;
  if (!aggregates.recorded) resultat = say('mappe.results.notYet');
  else if (aggregates.suppressed) resultat = say('mappe.results.suppressed', { k: format.number(k) });
  else {
    resultat = say('mappe.results.summary', {
      participants: figures.deltakarar,
      completion: figures.fullforing,
      median: figures.median_forsok,
      change: figures.endring,
    });
  }
  return { resultat, ...figures };
}

/**
 * The view of one selected activity.
 * @param inputs - The activity, its findings and aggregates, its phase label, link and *k*.
 * @param format - The portfolio's language's formats.
 * @returns Every item value as non-empty text, and its findings.
 * @spec MAPPE-002
 */
export function mappeActivityView(inputs: MappeActivityInputs, format: MappeFormat): MappeActivityView {
  const say: Say = (key, params = {}) => t(key, params, format.locale);
  const { activity } = inputs;
  return {
    tittel: orPlaceholder(activity.title, say('mappe.placeholder.untitled')),
    innhaldstype: contentTypeName(activity.mainLibrary, say),
    status: say(activity.status === 'published' ? 'mappe.status.published' : 'mappe.status.draft'),
    fase: orPlaceholder(inputs.phaseLabel, say('mappe.placeholder.phase')),
    emne: orPlaceholder(activity.courseCode, say('mappe.placeholder.course')),
    laeringsutbytte: orPlaceholder(outcomesText(activity.outcomes, say), say('mappe.placeholder.outcomes')),
    grunngjeving: orPlaceholder(activity.rationale, say('mappe.placeholder.rationale')),
    uu_status: findingsSummary(inputs.findings, format, say),
    lenke: inputs.link,
    ...resultFigures(inputs.aggregates, format, say, inputs.k),
    oppretta: format.date(activity.createdAt),
    endra: format.date(activity.updatedAt),
    publisert: activity.publishedAt
      ? format.date(activity.publishedAt)
      : say('mappe.placeholder.notPublished'),
    uu_merknader: inputs.findings.map((finding) => findingView(finding, format, say)),
  };
}
