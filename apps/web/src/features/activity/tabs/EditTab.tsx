/**
 * EditTab — the **Rediger** tab of the activity page: the formative-use notice and H5P's editor, framed from Express.
 *
 * Why: authors edit an activity on its own page (PROD-003, D-067). The notice reminds them that H5P scores are
 *      formative (PROD-011). The editor reports each save (`hvli:content-saved`) to the page, which owns the reaction.
 * Spec: PROD-003, PROD-011, H5P-006, UD-006
 * Invariants:
 *   - Shown only to people who may edit (`mayEdit`, ./activityTabs.ts); Express checks again on every editor request.
 *   - The frame has a title that names the activity (WCAG 4.1.2), and tells the page when it has loaded, so a waiting
 *     «Gå til feltet» reaches it.
 * Collaborators: ./activityTab.ts, ./activityTabs.ts, ../../../components/H5pFrame.tsx,
 *   ../../../components/Notice.tsx, ../../../config/paths.ts.
 * Tests: apps/web/test/features/ActivityView.test.tsx
 */
'use client';

import { H5pFrame } from '../../../components/H5pFrame';
import { Notice } from '../../../components/Notice';
import { editorPath } from '../../../config/paths';
import { useLocale } from '../../../i18n/LocaleContext';
import { t } from '../../../i18n/translate';
import type { ActivityTabProps } from './activityTab';

/** The **Rediger** tab's `id`. */
export const EDIT_TAB_ID = 'edit';

/**
 * The editor panel.
 * @param props - The activity and the frames.
 * @returns The formative-use notice and the titled editor frame.
 */
export function EditTab({ detail, frames }: ActivityTabProps) {
  const locale = useLocale();
  return (
    <>
      <Notice />
      <H5pFrame
        editor
        src={editorPath(detail.id)}
        title={t('activity.editFrame', locale, { title: detail.title })}
        frameRef={frames.editorRef}
        onLoad={frames.onEditorLoad}
      />
    </>
  );
}
