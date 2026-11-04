/**
 * InsightQueryForm — what the Innsikt tab shows: a period from the fixed choices, a content version (the current one
 * by default) and, on the activity page, one of the activity's contexts; «Vis innsikt» applies them. In Canvas the
 * course is named instead, as the launch fixes it.
 *
 * Why: D-106 gives one view of one activity, one version (PROD-013) and one context at a time, with fixed periods
 *      only, so no free date can difference two views. The choices are applied with a button, not on change, so
 *      picking an option never reloads the view under the reader (WCAG 3.2.2), and the hint says why there is no
 *      date field.
 * Spec: INS-007, PROD-013, PROD-010, UD-006, UD-013
 * Invariants:
 *   - SPEC-DEVIATION: D-106 — the period is chosen from ./insightPeriods.ts, never typed as a date.
 *   - Versions are offered from the current one down to 1, only when there is more than one.
 *   - A11Y: each control has a visible label; the fields are a group named by its legend; the hint describes the
 *     period field. In Canvas the context is text, never a control (D-106).
 * Collaborators: ./insightPeriods.ts, ./insightContextLabels.ts, ./InsightPanel.tsx.
 * Tests: apps/web/test/features/insight/InsightQuery.test.tsx
 */
'use client';

import type { InsightContext, InsightPeriod, InsightQuery } from '@hvl-interaktiv/api-contract';
import { useId, useState, type FormEvent } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { contextOptions } from './insightContextLabels';
import { DEFAULT_PERIOD, PERIODS, periodName } from './insightPeriods';

const CONTROL = 'min-h-target rounded border-2 border-hvl-ink-muted bg-hvl-surface p-1';

/** What the form needs. */
export interface InsightQueryFormProps {
  /** The query of the view asked for last. */
  readonly query: InsightQuery;
  /** The newest version, once a view has told it. */
  readonly currentVersion: number | undefined;
  /** The contexts to choose from on the activity page; undefined in Canvas or while they load. */
  readonly contexts: readonly InsightContext[] | undefined;
  readonly onApply: (query: InsightQuery) => void;
}

/**
 * The form.
 * @param props - The applied query, the versions and contexts to offer, and the apply handler.
 * @returns The form.
 */
export function InsightQueryForm({ query, currentVersion, contexts, onApply }: InsightQueryFormProps) {
  const locale = useLocale();
  const id = useId();
  const [period, setPeriod] = useState<InsightPeriod>(query.period ?? DEFAULT_PERIOD);
  const [version, setVersion] = useState(query.version ?? '');
  const [context, setContext] = useState(query.context ?? '');
  const versions = currentVersion && currentVersion > 1 ? currentVersion : 0;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply({
      period,
      ...(version ? { version } : {}),
      ...(contexts && context ? { context } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="mb-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-lg font-bold">{t('insight.query.legend', locale)}</legend>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor={`${id}-period`} className="block font-bold">
              {t('insight.query.period', locale)}
            </label>
            <select
              id={`${id}-period`}
              value={period}
              aria-describedby={`${id}-hint`}
              onChange={(event) => setPeriod(event.target.value as InsightPeriod)}
              className={CONTROL}
            >
              {PERIODS.map((choice) => (
                <option key={choice} value={choice}>
                  {periodName(choice, locale)}
                </option>
              ))}
            </select>
          </div>
          {versions > 0 ? (
            <div>
              <label htmlFor={`${id}-version`} className="block font-bold">
                {t('insight.query.version', locale)}
              </label>
              <select
                id={`${id}-version`}
                value={version || String(versions)}
                onChange={(event) =>
                  setVersion(event.target.value === String(versions) ? '' : event.target.value)
                }
                className={CONTROL}
              >
                {Array.from({ length: versions }, (_, index) => versions - index).map((number) => (
                  <option key={number} value={String(number)}>
                    {t(
                      number === versions ? 'insight.query.versionCurrent' : 'insight.query.versionOlder',
                      locale,
                      {
                        version: number,
                      },
                    )}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {contexts ? (
            <div>
              <label htmlFor={`${id}-context`} className="block font-bold">
                {t('insight.query.context', locale)}
              </label>
              <select
                id={`${id}-context`}
                value={context}
                onChange={(event) => setContext(event.target.value)}
                className={CONTROL}
              >
                {contextOptions(contexts, locale).map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <button type="submit" className="button-primary">
            {t('insight.query.submit', locale)}
          </button>
        </div>
        <p id={`${id}-hint`} className="mb-0 mt-2">
          {t('insight.query.periodHint', locale)}
        </p>
      </fieldset>
    </form>
  );
}
