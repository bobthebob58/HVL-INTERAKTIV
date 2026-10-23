/**
 * helpSections — the sections of the help page, as message keys in reading order.
 *
 * Why: the help page's order lives apart from the page file, which Next.js allows to export only page fields.
 * Spec: UD-013
 * Invariants:
 *   - Every key exists in nn, nb and en (the locale files are checked for the same keys).
 * Collaborators: ../../components/TextSections.tsx, ../../app/(portal)/hjelp/page.tsx.
 * Tests: apps/web/test/components/TextSections.test.tsx
 */
import type { TextSection } from '../../components/TextSections';

/** The help text, in reading order. */
export const HELP_SECTIONS: readonly TextSection[] = [
  {
    heading: 'help.createHeading',
    kind: 'steps',
    texts: ['help.create1', 'help.create2', 'help.create3', 'help.create4'],
  },
  {
    heading: 'help.checkHeading',
    kind: 'steps',
    texts: ['help.check1', 'help.check2', 'help.check3', 'help.check4'],
  },
  { heading: 'help.canvasHeading', kind: 'paragraphs', texts: ['help.canvas1', 'help.canvas2'] },
  { heading: 'help.accessHeading', kind: 'paragraphs', texts: ['help.access1'] },
  { heading: 'help.moreHeading', kind: 'paragraphs', texts: ['help.more1', 'help.more2'] },
];
