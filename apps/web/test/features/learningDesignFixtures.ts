/**
 * learningDesignFixtures — the API answers the **Læringsdesign** tab, the publish prompt and the planner tests fake:
 * an activity, a studio overview in the contract's shape with test labels, and stored metadata.
 *
 * Why: the tab and the planner take the phase labels from `GET /api/studio` (PED-001), which the guide workstream
 *      serves; the tests answer it with the contract's shape. The labels are test texts, never the real content,
 *      which ALU edits.
 * Spec: PED-030, PED-031
 * Collaborators: ../support/fakeFetch.ts, packages/api-contract (types only).
 * Tests: used by LearningDesignPanel.test.tsx, OutcomeFields.test.tsx, LearningDesignPrompt.test.tsx,
 *   PlannerTable.test.tsx and PlannerView.test.tsx in this folder.
 */
import type { ContentDetail, LearningDesign, PhaseKey, StudioOverview } from '@hvl-interaktiv/api-contract';

/** The test activity's ID. */
export const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';

/** An activity its owner may edit and publish. */
export const DETAIL: ContentDetail = {
  id: ID,
  title: 'Celler og vev',
  mainLibrary: 'H5P.Column',
  status: 'draft',
  visibility: 'private',
  updatedAt: '2026-10-23T10:00:00.000Z',
  publishedAt: null,
  role: 'owner',
  mayEdit: true,
  mayPublish: true,
  language: 'nn',
};

const text = (value: string) => ({ nn: value, nb: `${value} (nb)`, en: `${value} (en)` });
const PHASE_LABELS: Readonly<Record<PhaseKey, string>> = {
  forarbeid: 'Testfase før',
  underveis: 'Testfase mellom',
  etterarbeid: 'Testfase etter',
};

/** A studio overview with test labels, in content order. */
export const OVERVIEW: StudioOverview = {
  status: 'proposed',
  anchor: { label: text('Samling'), description: text('Møtet') },
  phases: (['forarbeid', 'underveis', 'etterarbeid'] as const).map((key, index) => ({
    key,
    order: index + 1,
    label: text(PHASE_LABELS[key]),
    description: text('Skildring'),
    purpose: text('Formål'),
    canvasPlacement: text('Plassering'),
  })),
  patterns: [
    {
      id: 'fa-video',
      phases: ['forarbeid'],
      contentTypes: ['H5P.InteractiveVideo'],
      name: text('Testmønster'),
      purpose: text('Formål'),
      buildMinutes: 30,
      available: true,
    },
  ],
};

/** Stored metadata with every field set. */
export const STORED: LearningDesign = {
  phase: 'underveis',
  courseCode: 'SYK110',
  outcomes: [
    { text: 'Forklare blodtrykk', category: 'kunnskap' },
    { text: 'Måle puls', category: 'ferdigheiter' },
  ],
  rationale: 'Henting styrkjer minnet.',
  estimatedStudentMinutes: 15,
  learnerPurpose: 'Du øver før samlinga.',
  patternId: 'fa-video',
  updatedAt: '2026-10-28T12:00:00.000Z',
};

/** The metadata path of the test activity. */
export const METADATA_PATH = `/api/content/${ID}/learning-design`;
