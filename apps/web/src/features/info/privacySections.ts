/**
 * privacySections — the sections of the privacy notice, as message keys in reading order.
 *
 * Why: the notice's order lives apart from the page file, which Next.js allows to export only page fields (DATA-006).
 * Spec: DATA-006
 * Invariants:
 *   - Every key exists in nn, nb and en (the locale files are checked for the same keys).
 *   - Each sentence about what is kept, and for how long, matches a row of docs/privacy/DATA-INVENTORY.md; the content
 *     test pins the pairs, so a change on either side fails until both agree.
 * Collaborators: ../../components/TextSections.tsx, ../../app/(portal)/personvern/page.tsx.
 * Tests: apps/web/test/components/TextSections.test.tsx, apps/web/test/features/privacyNotice.test.ts,
 *   apps/web/test/features/privacyNoticeScope.test.ts
 */
import type { TextSection } from '../../components/TextSections';

/** The privacy notice, in reading order. */
export const PRIVACY_SECTIONS: readonly TextSection[] = [
  {
    heading: 'privacy.learnersHeading',
    kind: 'paragraphs',
    texts: [
      'privacy.learners1',
      'privacy.learners2',
      'privacy.learners3',
      'privacy.learners4',
      'privacy.learners5',
    ],
  },
  {
    heading: 'privacy.loginHeading',
    kind: 'paragraphs',
    texts: ['privacy.login1', 'privacy.login2', 'privacy.login3', 'privacy.login4'],
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
  {
    heading: 'privacy.staffHeading',
    kind: 'paragraphs',
    // PRIVACY: staff names are visible to colleagues through co-author search and the bank (D-090, D-091, DATA-006).
    texts: ['privacy.staff1', 'privacy.staff2', 'privacy.staff3'],
  },
  { heading: 'privacy.safetyHeading', kind: 'paragraphs', texts: ['privacy.safety1', 'privacy.safety2'] },
  { heading: 'privacy.rightsHeading', kind: 'paragraphs', texts: ['privacy.rights1'] },
];
