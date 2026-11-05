/**
 * InsightReportView — one insight view on the Innsikt tab: what it covers, the privacy note with the view's k, then
 * participation (INS-001), questions hardest first (INS-002), misconceptions (INS-003), video engagement (INS-005) and
 * the CSV download (INS-009); or, when there is nothing to show, why.
 *
 * Why: the tab answers "what should the next seminar take up?" (PROD-010, spec 05) from one already suppressed answer.
 *      D-115 has an activity type that sends no learning data (ImageHotspots) say so instead of showing empty numbers,
 *      and an empty period or one with fewer than k learners says so too, rather than a page of zeros and «< k».
 * Spec: PROD-010, INS-001, INS-002, INS-003, INS-005, INS-006, INS-009, PROD-013
 * Invariants:
 *   - The scope line names the context, the period with its start and the content version the numbers are for;
 *     under it, the period note says the numbers run up to and including yesterday, and when the period was
 *     shortened to start on 1 August (D-106's amendment of 2026-11-04).
 *   - Sections appear only when the type sends learning data and at least one learner is shown; video engagement
 *     only for an InteractiveVideo.
 *   - The CSV is of the view on screen: the query is taken from its scope, not from the form.
 * Collaborators: ./insightScopeText.ts, ./ParticipationSection.tsx, ./ItemDifficultySection.tsx,
 *   ./MisconceptionSection.tsx, ./VideoEngagementSection.tsx, ./InsightCsvDownload.tsx, ./InsightNotes.tsx,
 *   ./InsightPanel.tsx.
 * Tests: apps/web/test/features/insight/InsightPanel.test.tsx, apps/web/test/features/insight/InsightViewState.test.tsx
 */
'use client';

import type { InsightQuery } from '@hvl-interaktiv/api-contract';
import { contentTypeName } from '../../i18n/contentTypeName';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { InsightCsvDownload } from './InsightCsvDownload';
import { PeriodInsightNote, PrivacyInsightNote } from './InsightNotes';
import type { InsightReport } from './insightReportShape';
import { scopeSentence } from './insightScopeText';
import { ItemDifficultySection } from './ItemDifficultySection';
import { MisconceptionSection } from './MisconceptionSection';
import { ParticipationSection } from './ParticipationSection';
import { VideoEngagementSection } from './VideoEngagementSection';

/**
 * The query of the view on screen, for its CSV.
 * @param report - The view.
 * @param fixedContext - True in Canvas, where the launch fixes the context and none is sent.
 * @returns The period, version and (portal only) context of the view.
 */
export const queryOfView = (report: InsightReport, fixedContext: boolean): InsightQuery => ({
  period: report.scope.period,
  version: String(report.scope.contentVersion),
  ...(fixedContext ? {} : { context: report.scope.context.key }),
});

/**
 * One view.
 * @param props - The view, the activity and whether the context is fixed (Canvas).
 * @returns What the view covers and its sections.
 */
export function InsightReportView({
  report,
  contentId,
  fixedContext,
}: {
  readonly report: InsightReport;
  readonly contentId: string;
  readonly fixedContext: boolean;
}) {
  const locale = useLocale();
  const { k } = report.scope;
  const started = report.participation.started;
  let body;
  if (!report.activity.sendsLearningData) {
    const type = contentTypeName(report.activity.mainLibrary, locale);
    body = <p>{t('insight.noLearningData', locale, { type })}</p>;
  } else if (!started.suppressed && started.value === 0) {
    body = <p>{t('insight.empty', locale)}</p>;
  } else {
    body = (
      <>
        {started.suppressed ? <p>{t('insight.allSuppressed', locale, { k })}</p> : null}
        <ParticipationSection
          participation={report.participation}
          sendsRootResult={report.activity.sendsRootResult}
          k={k}
        />
        <ItemDifficultySection items={report.items} k={k} />
        <MisconceptionSection
          misconceptions={report.misconceptions}
          k={k}
          olderVersion={report.scope.contentVersion < report.scope.currentVersion}
        />
        {report.videoEngagement ? (
          <VideoEngagementSection interactions={report.videoEngagement} k={k} />
        ) : null}
        <InsightCsvDownload contentId={contentId} query={queryOfView(report, fixedContext)} />
      </>
    );
  }
  return (
    <>
      <p className="font-bold">{scopeSentence(report, locale)}</p>
      <PeriodInsightNote scope={report.scope} />
      <PrivacyInsightNote k={k} />
      {body}
    </>
  );
}
