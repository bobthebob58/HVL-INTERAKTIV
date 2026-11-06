/**
 * insightOtherAnswers — the other insight views the Innsikt tab tests fake: an InteractiveVideo (INS-005, no final
 * result), an ImageHotspots activity that sends no learning data, a period nobody played, and the validator's findings.
 *
 * Why: each view is one state the tab must handle (D-115: "not available" is not 0; ImageHotspots says it sends no
 *      learning data); they build on ./insightAnswers.ts's question set, so only what differs is written here.
 * Spec: INS-001, INS-005, INS-010
 * Collaborators: ./insightAnswers.ts, packages/api-contract (types only).
 * Tests: used by the tests in this folder.
 */
import type { InsightReport } from '../../../src/features/insight/insightReportShape';
import { HIDDEN, REPORT, shown } from './insightAnswers';

/** An InteractiveVideo with two tasks and the summary at the end. */
export const VIDEO_REPORT: InsightReport = {
  ...REPORT,
  activity: { mainLibrary: 'H5P.InteractiveVideo', sendsLearningData: true, sendsRootResult: false },
  participation: {
    ...REPORT.participation,
    completed: null,
    completionRate: null,
    completionBase: null,
    medianAttempts: null,
  },
  items: [],
  misconceptions: [],
  videoEngagement: [
    {
      item: 'v1',
      library: 'H5P.MultiChoice',
      label: 'Kva ser du?',
      questionText: null,
      atSeconds: 45,
      answered: shown(20),
      share: shown(0.9),
    },
    {
      item: 'v2',
      library: 'H5P.Blanks',
      label: null,
      questionText: 'Skriv namnet.',
      atSeconds: 310,
      answered: shown(9),
      share: shown(0.4),
    },
    {
      item: 'v3',
      library: 'H5P.Summary',
      label: null,
      questionText: null,
      atSeconds: null,
      answered: HIDDEN,
      share: HIDDEN,
    },
  ],
};

/** An ImageHotspots activity: it sends no learning data (D-115). */
export const HOTSPOTS_REPORT: InsightReport = {
  ...REPORT,
  activity: { mainLibrary: 'H5P.ImageHotspots', sendsLearningData: false, sendsRootResult: false },
  items: [],
  misconceptions: [],
};

/** A period in which nobody played. */
export const EMPTY_REPORT: InsightReport = {
  ...REPORT,
  participation: { ...REPORT.participation, started: shown(0), completed: shown(0) },
  items: [],
  misconceptions: [],
};

/** One finding with a reason that holds. */
export const FINDINGS = {
  updatedAt: '2026-11-01T10:00:00.000Z',
  findings: [
    {
      ruleId: 'V-IMG-ALT',
      severity: 'error',
      requirement: 'UD-021',
      path: 'questions[0].params.media.alt',
      message: 'Biletet manglar alternativ tekst.',
      acknowledgement: {
        reason: 'Biletet er pynt.',
        at: '2026-11-01T10:00:00.000Z',
        expiresAt: '2026-11-15T10:00:00.000Z',
      },
    },
    {
      ruleId: 'PED-H05',
      severity: 'hint',
      requirement: 'PED-020',
      path: '',
      message: 'Legg gjerne til tilbakemelding på kvart svar.',
      acknowledgement: null,
    },
  ],
};
