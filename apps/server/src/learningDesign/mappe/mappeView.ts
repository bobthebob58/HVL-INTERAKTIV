/**
 * mappeView — the whole view a pedagogisk mappe template is rendered with: the top-level values, the selected
 * activities and the course overview, all as text in the portfolio's language.
 *
 * Why: D-094 renders the portfolio from the template with Mustache; its probe amendment wants a view in which every
 *      key exists and every value is already text. The course overview (`{{#emneoversikt}}`) gives criterion 1.1
 *      the courses and activities per phase from the author's own work, with no learner data (MAPPE-002).
 * Spec: MAPPE-002, MAPPE-003, PED-001
 * Invariants:
 *   - Builds exactly the keys of `MappeView` (./mappeVariables.ts); the compiler checks the set.
 *   - Phase labels come from the content, in the content's order (PED-001); never a hard-coded label.
 *   - The note about results says "no results yet" while none are recorded (D-095), and that they are formative
 *     anonymised aggregates for groups of at least *k* otherwise.
 *   - Pure: the caller passes the moment of the export.
 * Collaborators: ./MappeRenderer.ts (the caller), ./mappeActivityView.ts, ./mappeFormat.ts, ./mappeVariables.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappeView.test.ts
 */
import { t, type MessageKey } from '../../i18n/translate.js';
import { mappeActivityView, orPlaceholder, type MappeActivityInputs } from './mappeActivityView.js';
import type { MappeFormat } from './mappeFormat.js';
import type { MappeCourseView, MappeView } from './mappeVariables.js';

/** One phase as the overview names it: its key and its label from the content in the portfolio's language. */
export interface MappePhaseLabel {
  readonly key: string;
  readonly label: string;
}

/** What the view is built from. */
export interface MappeViewInputs {
  /** The selected activities, in the order the author chose. */
  readonly activities: readonly MappeActivityInputs[];
  /** The author's name, when the account has one. */
  readonly authorName?: string;
  /** The criteria set's title in the portfolio's language. */
  readonly criteriaSetTitle: string;
  readonly wordLimit: number;
  readonly attachmentLimit: number;
  /** The minimum group size *k* (D-095). */
  readonly k: number;
  /** When the portfolio is made. */
  readonly now: Date;
  /** The phases in the content's order. */
  readonly phases: readonly MappePhaseLabel[];
  /** Whether results are recorded at all (false in S5, D-095). */
  readonly resultsRecorded: boolean;
  /** The Del 1 word count to show (0 on the first of the two renders, ./mappeRender.ts). */
  readonly words: number;
}

type Say = (key: MessageKey, params?: Record<string, string | number>) => string;

function courseOverview(inputs: MappeViewInputs, format: MappeFormat, say: Say): MappeCourseView[] {
  const byCourse = new Map<string, MappeActivityInputs[]>();
  for (const entry of inputs.activities) {
    const code = entry.activity.courseCode ?? '';
    byCourse.set(code, [...(byCourse.get(code) ?? []), entry]);
  }
  // WHY: courses in code order, the activities without a code last, so the list reads like a course catalogue.
  const codes = [...byCourse.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  return codes.map((code) => {
    const entries = byCourse.get(code) ?? [];
    const count = (phase?: string) => entries.filter((entry) => entry.activity.phase === phase).length;
    const parts = inputs.phases
      .filter((phase) => count(phase.key) > 0)
      .map((phase) =>
        say('mappe.phaseCount', { phase: phase.label, count: format.number(count(phase.key)) }),
      );
    const unphased = count(undefined);
    if (unphased > 0) {
      parts.push(say('mappe.phaseCount', { phase: say('mappe.noPhase'), count: format.number(unphased) }));
    }
    return {
      emnekode: orPlaceholder(code, say('mappe.placeholder.course')),
      tal: format.number(entries.length),
      fasar: parts.join(', '),
    };
  });
}

/**
 * Builds the view of a portfolio.
 * @param inputs - The activities and everything else the template may show.
 * @param format - The portfolio's language's formats.
 * @returns The view: every value text, every list item complete.
 * @spec MAPPE-002
 */
export function mappeView(inputs: MappeViewInputs, format: MappeFormat): MappeView {
  const say: Say = (key, params = {}) => t(key, params, format.locale);
  const k = format.number(inputs.k);
  return {
    forfattar: orPlaceholder(inputs.authorName, say('mappe.placeholder.author')),
    dato: format.date(inputs.now),
    k,
    ordtal_del1: format.number(inputs.words),
    ordgrense: format.number(inputs.wordLimit),
    maks_vedlegg: format.number(inputs.attachmentLimit),
    kriteriesett: inputs.criteriaSetTitle,
    aktivitetar_tal: format.number(inputs.activities.length),
    samarbeid_tal: format.number(inputs.activities.filter((entry) => entry.activity.collaborative).length),
    resultat_merknad: inputs.resultsRecorded
      ? say('mappe.results.noteRecorded', { k })
      : say('mappe.results.noteNotYet'),
    aktivitetar: inputs.activities.map((entry) => mappeActivityView(entry, format)),
    emneoversikt: courseOverview(inputs, format, say),
  };
}
