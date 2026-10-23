/**
 * privacySections — the sections of the privacy notice, as message keys in reading order.
 *
 * Why: the notice's order lives apart from the page file, which Next.js allows to export only page fields (DATA-006).
 * Spec: DATA-006
 * Invariants:
 *   - Every key exists in nn, nb and en (the locale files are checked for the same keys).
 * Collaborators: ../../components/TextSections.tsx, ../../app/(portal)/personvern/page.tsx.
 * Tests: apps/web/test/components/TextSections.test.tsx
 */
import type { TextSection } from '../../components/TextSections';

/** The privacy notice, in reading order. */
export const PRIVACY_SECTIONS: readonly TextSection[] = [
  {
    heading: 'privacy.learnersHeading',
    kind: 'paragraphs',
    texts: ['privacy.learners1', 'privacy.learners2', 'privacy.learners3', 'privacy.learners4'],
  },
  {
    heading: 'privacy.whyHeading',
    kind: 'paragraphs',
    texts: ['privacy.why1', 'privacy.why2', 'privacy.why3'],
  },
  {
    heading: 'privacy.howLongHeading',
    kind: 'paragraphs',
    texts: ['privacy.howLong1', 'privacy.howLong2', 'privacy.howLong3'],
  },
  {
    heading: 'privacy.whoHeading',
    kind: 'paragraphs',
    texts: ['privacy.who1', 'privacy.who2', 'privacy.who3'],
  },
  { heading: 'privacy.staffHeading', kind: 'paragraphs', texts: ['privacy.staff1', 'privacy.staff2'] },
  { heading: 'privacy.safetyHeading', kind: 'paragraphs', texts: ['privacy.safety1', 'privacy.safety2'] },
  { heading: 'privacy.rightsHeading', kind: 'paragraphs', texts: ['privacy.rights1'] },
];
