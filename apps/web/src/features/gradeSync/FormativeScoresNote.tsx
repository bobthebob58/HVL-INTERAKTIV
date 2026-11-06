/**
 * FormativeScoresNote — the label on the grade-sync panel that says the scores are formative: computed in the
 * browser, meant for learning along the way, and neither exam evidence nor grades, although Canvas shows them in its
 * gradebook.
 *
 * Why: CLAUDE.md §1 labels AGS scores formative and never presents them as exam evidence; LTI-013 (c) and D-105 have
 *      the grade-sync status say so, with PROD-011's notice or a label from the same locale texts. It uses the
 *      notice's own title and body (`notice.formativeUse`), so the two never drift apart, and adds one line about
 *      the gradebook. Unlike the notice beside the editor, it cannot be dismissed: it belongs to every view of scores.
 * Spec: LTI-013, PROD-011, UD-003
 * Invariants:
 *   - A11Y: a region named by its own heading, as the notice is; the ℹ︎ icon is `aria-hidden`.
 *   - The colours are the notice's information tokens (D-017).
 * Collaborators: ./GradeSyncPanel.tsx, ../../components/Notice.tsx (`INFO_ICON`, the same texts).
 * Tests: apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx
 */
'use client';

import { useId } from 'react';
import { INFO_ICON } from '../../components/Notice';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/**
 * The formative label.
 * @returns The labelled note.
 */
export function FormativeScoresNote() {
  const locale = useLocale();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mb-4 bg-hvl-feedback-info-bg p-4 text-hvl-feedback-info-fg">
      <h3 id={titleId} className="text-hvl-feedback-info-fg">
        <span aria-hidden="true">{INFO_ICON} </span>
        {t('notice.formativeUse.title', locale)}
      </h3>
      <p className="mb-0">
        {t('notice.formativeUse.body', locale)} {t('gradeSync.formativeGradebook', locale)}
      </p>
    </section>
  );
}
