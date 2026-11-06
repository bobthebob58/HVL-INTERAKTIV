/**
 * insightActivities — the parameters of the activities the insight fixture plays: a QuestionSet with a MultiChoice, a
 * Blanks and a DragText; an InteractiveVideo with three answerable interactions; and an ImageHotspots.
 *
 * Why: insight reads the question texts, options, feedback and gaps from the activity's own parameters (INS-002,
 *      INS-003) and the interactions of a video (INS-005); the hand-calculated values in ./README.md are about these
 *      parameters. The sub-content nodes are nested as H5P nests them (`{ library, params, subContentId }`).
 * Spec: INS-001, INS-002, INS-003, INS-005
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/videoLearners.test.ts,
 *   apps/server/test/insight/insightService.int.test.ts
 */

/** The QuestionSet's questions. */
export const Q1 = '6c1f0a52-3d8e-4b7a-9f21-5e4c8b0d7a11';
export const Q2 = 'a83e5d27-91b4-4c6f-8e02-7d3b1f9c4e22';
export const Q3 = '2f7b9c41-6e0a-4d58-b3c7-9a1e5d8f0b33';

/** The InteractiveVideo's interactions (and a text, which sends nothing). */
export const IV1 = '3b9e6f12-7c4a-4d81-a2e5-0f6d8c1b9a51';
export const IV2 = '3b9e6f12-7c4a-4d81-a2e5-0f6d8c1b9a52';
export const IV3 = '3b9e6f12-7c4a-4d81-a2e5-0f6d8c1b9a53';

const multiChoice = {
  library: 'H5P.MultiChoice 1.16',
  subContentId: Q1,
  params: {
    question: '<p>Kva er <strong>hovudføremålet</strong> med forarbeid?</p>',
    answers: [
      {
        text: '<div>Aktivere forkunnskapar</div>',
        correct: true,
        tipsAndFeedback: { chosenFeedback: '<div>Ja.</div>' },
      },
      {
        text: '<div>Erstatte forelesinga</div>',
        correct: false,
        tipsAndFeedback: {
          chosenFeedback: '<div>Forarbeid førebur samlinga, det erstattar henne ikkje.</div>',
        },
      },
      {
        text: '<div>Gi karakter</div>',
        correct: false,
        tipsAndFeedback: { chosenFeedback: '<div>Poenga er formative &amp; gir ingen karakter.</div>' },
      },
      { text: '<div>Spare tid for læraren</div>', correct: false, tipsAndFeedback: { chosenFeedback: '' } },
    ],
  },
};

const blanks = {
  library: 'H5P.Blanks 1.14',
  subContentId: Q2,
  params: {
    text: '<p>Fyll inn orda som manglar.</p>',
    questions: [
      '<p>Å hente fram kunnskap heiter *uthenting:Tips*, og *spreidd/spredt* repetisjon hjelper.</p>',
    ],
    behaviour: { caseSensitive: false },
  },
};

const dragText = {
  library: 'H5P.DragText 1.10',
  subContentId: Q3,
  params: {
    taskDescription: 'Dra orda på rett plass.',
    textField: 'Ei *samling* kjem etter *forarbeid:Før samlinga*.',
    distractors: '*etterarbeid*',
  },
};

/** H5P.QuestionSet 1.21 with three questions. */
export const QUESTION_SET = {
  mainLibrary: 'H5P.QuestionSet',
  params: { introPage: { showIntroPage: false }, questions: [multiChoice, blanks, dragText] },
};

/** H5P.InteractiveVideo 1.28 without a submit screen, so it sends no root result (D-115, Q18). */
export const INTERACTIVE_VIDEO = {
  mainLibrary: 'H5P.InteractiveVideo',
  params: {
    interactiveVideo: {
      assets: {
        interactions: [
          {
            duration: { from: 450, to: 460 },
            label: '<p>Til slutt</p>',
            action: { ...blanks, subContentId: IV3 },
          },
          {
            duration: { from: 150, to: 160 },
            label: '<p>Første stopp</p>',
            action: {
              library: 'H5P.MultiChoice 1.16',
              subContentId: IV1,
              params: {
                question: '<p>Kva viser grafen?</p>',
                answers: [
                  { text: 'Vekst', correct: true },
                  { text: 'Nedgang', correct: false, tipsAndFeedback: { chosenFeedback: 'Sjå på aksen.' } },
                  { text: 'Ingenting', correct: false },
                ],
              },
            },
          },
          {
            duration: { from: 60, to: 70 },
            action: { library: 'H5P.Text 1.1', subContentId: 'text-1', params: {} },
          },
          {
            duration: { from: 300, to: 310 },
            action: {
              library: 'H5P.TrueFalse 1.8',
              subContentId: IV2,
              params: { question: '<p>Stemmer det?</p>' },
            },
          },
        ],
        endscreens: [],
      },
      summary: {
        task: { library: 'H5P.Summary 1.10', subContentId: 'summary-1', params: { summaries: [] } },
      },
    },
  },
};

/** H5P.ImageHotspots 1.11: it sends no statement at all (probe P1). */
export const IMAGE_HOTSPOTS = { mainLibrary: 'H5P.ImageHotspots', params: { hotspots: [] } };
