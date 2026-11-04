/**
 * InsightPanel — the **Innsikt** tab, on the activity page and in the Canvas view: «Innsikt før samlinga» for one
 * activity, one content version and one context at a time, with the formative and privacy notes, the period, version
 * and context choices, the view's sections, the «Ta opp i samlinga» list and the validator's findings.
 *
 * Why: PROD-010 and spec 05 give authors aggregated, anonymised results per activity to prepare the next synchronous
 *      session, never to watch or rank a student. D-101 and D-106 put it in a tab, one context at a time: on the
 *      activity page the owner or co-author picks a context; in `/app/play` the launch fixes it (LTI-006).
 * Spec: PROD-010, LTI-006, INS-001, INS-003, INS-006, INS-007, INS-008, INS-010, PROD-013, UD-006
 * Invariants:
 *   - PRIVACY: the tab shows only the server's aggregates; it never asks for or shows a learner (INS-006), and the
 *     shortlist, printout and CSV hold the same aggregates only.
 *   - The formative note is always shown (D-105); the privacy note with each view, with the view's k.
 *   - A11Y: one `h2`; every part is a section named by its `h3`. A new view is announced in the tab's own polite
 *     status region, also when the words repeat (WCAG 4.1.3); the previous view stays while the next loads.
 *   - Once a view has arrived, a refused, invalid or failed request keeps the choices (with that view's versions)
 *     and the shortlist with its entries, so the teacher can choose again or still print the list.
 *   - Works with the page's credential (`useApiAuth`): the session in the portal, the Bearer ltik in Canvas.
 * Collaborators: ./useInsightView.ts, ./InsightQueryForm.tsx, ./InsightReportView.tsx, ./insightScopeText.ts,
 *   ./InsightShortlist.tsx, ./shortlistContext.tsx, ./InsightFindings.tsx, ./InsightNotes.tsx,
 *   ../activity/tabs/InsightTab.tsx, ../lti/LtiPlayView.tsx, ../../components/useAnnouncement.ts.
 * Tests: apps/web/test/features/insight/InsightPanel.test.tsx, apps/web/test/features/insight/InsightQuery.test.tsx,
 *   apps/web/test/features/insight/InsightViewState.test.tsx
 */
'use client';

import { useCallback } from 'react';
import { useAnnouncement } from '../../components/useAnnouncement';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { contextName } from './insightContextLabels';
import { InsightFindings } from './InsightFindings';
import { FormativeInsightNote } from './InsightNotes';
import { InsightQueryForm } from './InsightQueryForm';
import type { InsightReport } from './insightReportShape';
import { InsightReportView } from './InsightReportView';
import { scopeSentence } from './insightScopeText';
import { InsightShortlist } from './InsightShortlist';
import { ShortlistContext, useShortlistState } from './shortlistContext';
import { useInsightView } from './useInsightView';

/** What the tab needs. */
export interface InsightPanelProps {
  readonly contentId: string;
  /** The activity's title, for the shortlist's printout and projection. */
  readonly title: string;
  /** True in Canvas: the launch fixes the context, which is named, not chosen (D-106). */
  readonly fixedContext?: boolean;
  /** Opens the **Sjekk og publiser** tab, on the activity page for those who get it. */
  readonly onOpenCheck?: () => void;
}

/**
 * The Innsikt tab's panel.
 * @param props - The activity, its title, whether the context is fixed, and the way to its check tab.
 * @returns The panel.
 */
export function InsightPanel({ contentId, title, fixedContext = false, onOpenCheck }: InsightPanelProps) {
  const locale = useLocale();
  const [announcement, announce] = useAnnouncement();
  const onUpdated = useCallback(
    (report: InsightReport) =>
      announce(t('insight.updated', locale, { scope: scopeSentence(report, locale) })),
    [announce, locale],
  );
  const view = useInsightView(contentId, fixedContext, onUpdated);
  const report = typeof view.state === 'object' ? view.state : undefined;
  const { latest } = view;
  const shortlist = useShortlistState(report, locale, announce);

  let body;
  if (view.state === 'loading') body = <p role="status">{t('common.loading', locale)}</p>;
  else if (view.state === 'unavailable') body = <p role="alert">{t('insight.unavailable', locale)}</p>;
  else if (view.state === 'invalid') body = <p role="alert">{t('insight.invalidQuery', locale)}</p>;
  else if (view.state === 'failed') body = <p role="alert">{t('common.loadFailed', locale)}</p>;
  else body = <InsightReportView report={view.state} contentId={contentId} fixedContext={fixedContext} />;

  return (
    <ShortlistContext.Provider value={shortlist}>
      <h2>{t('insight.heading', locale)}</h2>
      <p>{t('insight.intro', locale)}</p>
      <FormativeInsightNote />
      {view.state === 'unavailable' && !latest ? null : (
        <InsightQueryForm
          query={view.query}
          currentVersion={latest?.scope.currentVersion}
          contexts={fixedContext ? undefined : view.contexts}
          onApply={view.apply}
        />
      )}
      {fixedContext && latest ? (
        <p>
          {t('insight.query.fixedContext', locale, { context: contextName(latest.scope.context, locale) })}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div aria-busy={view.pending}>{body}</div>
      {report || shortlist.entries.length > 0 ? <InsightShortlist title={title} /> : null}
      <InsightFindings contentId={contentId} onOpenCheck={onOpenCheck} />
    </ShortlistContext.Provider>
  );
}
