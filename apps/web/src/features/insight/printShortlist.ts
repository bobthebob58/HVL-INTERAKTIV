/**
 * printShortlist — prints the «Ta opp i samlinga» list alone: it marks the document so the print stylesheet hides
 * everything but the list, opens the browser's print dialog, and removes the mark once printing is done.
 *
 * Why: INS-003's shortlist "can be printed or projected"; a teacher prints the questions for the seminar, not the
 *      whole tab. The mark is set only for this print, so printing the page any other way prints it as it is.
 * Spec: INS-003
 * Invariants:
 *   - The mark (`data-insight-print` on `<html>`) is removed on `afterprint`, and at once if printing throws.
 *   - PRIVACY: the printed list holds only what the shortlist shows: aggregates and the teacher's texts.
 * Collaborators: ./insightPrint.css (the rules the mark switches on), ./InsightShortlist.tsx.
 * Tests: apps/web/test/features/insight/InsightShortlist.test.tsx
 */

/** The attribute on `<html>` that switches the print stylesheet to the shortlist alone. */
export const PRINT_MARK = 'data-insight-print';

/**
 * Prints the shortlist alone.
 * @param view - The window to print; the page's own by default.
 */
export function printShortlist(view: Window = window): void {
  const root = view.document.documentElement;
  const done = () => {
    root.removeAttribute(PRINT_MARK);
    view.removeEventListener('afterprint', done);
  };
  root.setAttribute(PRINT_MARK, '');
  view.addEventListener('afterprint', done);
  try {
    view.print();
  } catch {
    done();
  }
}
