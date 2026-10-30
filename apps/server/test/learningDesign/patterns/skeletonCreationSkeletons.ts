/**
 * skeletonCreationSkeletons — minimal skeletons of four patterns for probe P1: fa-video (InteractiveVideo without a
 * video), uv-case (BranchingScenario), uv-module (InteractiveBook) and fa-hotspots (ImageHotspots without an image).
 *
 * Why: P1 must show that a skeleton holding only what the pattern is about, completed on the server with semantics
 *      defaults and fresh `subContentId`s, saves, opens in the editor and plays (D-084, D-085). These follow the
 *      pattern table of spec 04 §4; W2 writes the real ones in `content/`.
 * Spec: PED-010, PROD-001
 * Invariants: library versions are the newest installed minors (D-078); no media files, no `subContentId`s.
 * Collaborators: ./skeletonCreationQuestions.ts.
 * Tests: apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts
 */
import {
  guidance,
  guidanceBlanks,
  guidanceCheck,
  guidanceMultiChoice,
  guidanceParagraph,
  guidanceSummary,
  guidanceText,
} from './skeletonCreationQuestions.js';

/** One pattern's skeleton, as the creation API would build it before defaults and IDs. */
export interface ProbeSkeleton {
  /** The pattern ID of spec 04 §4. */
  readonly pattern: string;
  /** Main library as `H5P.Name x.y`. */
  readonly library: string;
  readonly params: Record<string, unknown>;
}

const interaction = (seconds: number, action: object) => ({
  x: 40,
  y: 40,
  width: 10,
  height: 10,
  duration: { from: seconds, to: seconds + 10 },
  pause: true,
  label: '',
  action,
});

const decision = (n: number, next: [number, number]) => ({
  type: {
    library: 'H5P.BranchingQuestion 1.0',
    params: {
      branchingQuestion: {
        question: guidanceParagraph(`Skriv avgjerd ${n}: kva skal studenten velje mellom?`),
        alternatives: next.map((nextContentId, i) => ({
          text: guidance(`Val ${i + 1}`),
          nextContentId,
          feedback: {
            title: guidanceParagraph('Kva skjer'),
            subtitle: guidanceParagraph('Forklar kvifor valet får denne følgja'),
            ...(nextContentId === -1 ? { endScreenScore: i === 0 ? 10 : 5 } : {}),
          },
        })),
      },
    },
    metadata: { contentType: 'Branching Question', license: 'U', title: `Avgjerd ${n}` },
  },
  // WHY: no `nextContentId`: a question's alternatives say where to go, and BranchingScenario's editor removes it.
  showContentTitle: false,
  feedback: {},
});

const passage = (title: string, text: string, nextContentId: number, proceed?: string) => ({
  type: guidanceText(title, text),
  showContentTitle: true,
  nextContentId,
  ...(proceed ? { proceedButtonText: guidance(proceed) } : {}),
  feedback: {},
});

const chapter = (n: number) => ({
  library: 'H5P.Column 1.22',
  params: {
    content: [
      { content: guidanceText(`Kapittel ${n}: tekst`, 'Skriv fagteksten, høgst 1 000 ord') },
      { content: guidanceCheck(`Kapittel ${n}: sjekk`) },
    ],
  },
  metadata: { contentType: 'Column', license: 'U', title: guidance(`Tittel på kapittel ${n}`) },
});

/** fa-video: three questions at 2:30, 5:00 and 7:30 and a summary task at the end; no video file yet. */
export const FA_VIDEO: ProbeSkeleton = {
  pattern: 'fa-video',
  library: 'H5P.InteractiveVideo 1.28',
  params: {
    interactiveVideo: {
      video: {
        startScreenOptions: {
          title: guidance('Tittel på videoen'),
          shortStartDescription: guidance('Skriv kva studenten skal sjå etter. Hald videoen på 6–9 minutt'),
        },
      },
      assets: {
        interactions: [
          interaction(150, guidanceMultiChoice('Spørsmål 1')),
          interaction(300, guidanceBlanks('Spørsmål 2')),
          interaction(450, guidanceMultiChoice('Spørsmål 3')),
        ],
        bookmarks: [],
        endscreens: [],
      },
      summary: { task: guidanceSummary('Oppsummering') },
    },
    override: { showSolutionButton: 'on', retryButton: 'on' },
  },
};

/** uv-case: intro → three decisions with feedback → endings, with a "try decision 1 again" path. */
export const UV_CASE: ProbeSkeleton = {
  pattern: 'uv-case',
  library: 'H5P.BranchingScenario 1.10',
  params: {
    branchingScenario: {
      title: guidance('Tittel på caset'),
      startScreen: {
        startScreenTitle: guidanceParagraph('Tittel på caset'),
        startScreenSubtitle: guidanceParagraph('Beskriv situasjonen studenten står i'),
      },
      content: [
        passage('Situasjonen', 'Beskriv det profesjonelle dilemmaet', 1),
        decision(1, [2, 4]),
        decision(2, [3, 3]),
        decision(3, [-1, -1]),
        passage('Følgja av valet', 'Beskriv kva valet førte til', 1, 'Prøv avgjerda på nytt'),
      ],
      endScreens: [
        {
          endScreenTitle: guidanceParagraph('Avslutning'),
          endScreenSubtitle: guidanceParagraph('Be studenten reflektere over vala sine'),
          endScreenScore: 0,
          contentId: -1,
        },
      ],
      scoringOptionGroup: { scoringOption: 'static-end-score' },
      behaviour: { enableBackwardsNavigation: true },
    },
  },
};

/** uv-module: three chapters of text and a three-question check, and the book's summary page. */
export const UV_MODULE: ProbeSkeleton = {
  pattern: 'uv-module',
  library: 'H5P.InteractiveBook 1.15',
  params: {
    chapters: [chapter(1), chapter(2), chapter(3)],
    behaviour: { displaySummary: true },
  },
};

const hotspot = (n: number) => ({
  position: { x: 15 * n, y: 50, legacyPositioning: false },
  alwaysFullscreen: false,
  header: guidance(`Overskrift ${n}`),
  content: [{ library: 'H5P.Text 1.1', params: { text: guidanceParagraph(`Forklar punkt ${n}`) } }],
});

/** fa-hotspots (beyond P1's three, to see the second media type): five numbered hotspots, no image yet. */
export const FA_HOTSPOTS: ProbeSkeleton = {
  pattern: 'fa-hotspots',
  library: 'H5P.ImageHotspots 1.11',
  params: {
    backgroundImageAltText: guidance('Skriv ein alternativ tekst som seier kva biletet viser'),
    globalIconType: 'numbers',
    hotspots: [1, 2, 3, 4, 5].map(hotspot),
  },
};

/** The skeletons of the probe, in the order the test creates them. */
export const PROBE_SKELETONS: readonly ProbeSkeleton[] = [FA_VIDEO, UV_CASE, UV_MODULE, FA_HOTSPOTS];
