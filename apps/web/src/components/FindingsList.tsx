/**
 * FindingsList — the validator's findings for one activity, grouped by severity, each with a "Gå til feltet" button.
 *
 * Why: PROD-003 lists findings in plain language with a *Go to field* link. Severity is shown by an icon and a word
 *      ("✗ Feil:", "! Åtvaring:", "i Tips:"), not by colour alone (UD-003); errors come first because only they block
 *      publishing. An error that an author has explained shows the reason and until when it holds (UD-022).
 * Spec: PROD-003, UD-003, UD-022, UD-013
 * Invariants:
 *   - Groups appear in the order error, warning, hint; empty groups are left out.
 *   - "Gå til feltet" appears only for a finding with a path; it calls `onGoToField(path)`, and its accessible
 *     description is the finding's message, so identical buttons stay distinguishable.
 *   - Messages come from the server, already in the person's language.
 * Collaborators: ../features/activity/CheckPanel.tsx, ../messaging/frameMessages.ts (`postGoToField`),
 *   ../i18n/formatDate.ts.
 * Tests: apps/web/test/components/FindingsList.test.tsx
 */
'use client';

import type { FindingSeverity, FindingWithAcknowledgement } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { formatDate } from '../i18n/formatDate';
import { useLocale } from '../i18n/LocaleContext';
import { t, type MessageKey } from '../i18n/translate';

/** The order of the groups, most severe first. */
export const SEVERITY_ORDER: readonly FindingSeverity[] = ['error', 'warning', 'hint'];

/** The icon of each severity; always shown next to the severity word. */
export const SEVERITY_ICON: Readonly<Record<FindingSeverity, string>> = {
  error: '✗',
  warning: '!',
  hint: 'ℹ︎',
};

const GROUP_TITLE: Readonly<Record<FindingSeverity, MessageKey>> = {
  error: 'findings.groupError',
  warning: 'findings.groupWarning',
  hint: 'findings.groupHint',
};

const GROUP_STYLE: Readonly<Record<FindingSeverity, string>> = {
  error: 'border-hvl-feedback-incorrect-border bg-hvl-feedback-incorrect-bg text-hvl-feedback-incorrect-fg',
  warning: 'border-hvl-ink-muted bg-hvl-surface text-hvl-ink',
  hint: 'border-hvl-feedback-info-fg bg-hvl-feedback-info-bg text-hvl-feedback-info-fg',
};

/** What the list needs. */
export interface FindingsListProps {
  readonly findings: readonly FindingWithAcknowledgement[];
  /** Opens the editor at the field a finding's path names. */
  readonly onGoToField: (path: string) => void;
  /** False hides the "Gå til feltet" buttons, e.g. for a person who may not edit. */
  readonly canGoToField?: boolean;
}

/**
 * The findings, grouped by severity.
 * @param props - The findings and the "Gå til feltet" handler.
 * @returns The list, or a sentence saying there is nothing to fix.
 */
export function FindingsList({ findings, onGoToField, canGoToField = true }: FindingsListProps) {
  const locale = useLocale();
  const base = useId();
  if (findings.length === 0) return <p>{t('findings.none', locale)}</p>;
  // WHY: "warnings and hints do not block" is said once, under the first group it applies to.
  const firstOther = SEVERITY_ORDER.find((s) => s !== 'error' && findings.some((f) => f.severity === s));
  return (
    <div>
      {SEVERITY_ORDER.map((severity) => {
        const group = findings.filter((finding) => finding.severity === severity);
        if (group.length === 0) return null;
        return (
          <section key={severity} aria-labelledby={`${base}-${severity}`} className="mb-6">
            <h3 id={`${base}-${severity}`}>{t(GROUP_TITLE[severity], locale, { count: group.length })}</h3>
            {severity === 'error' ? <p>{t('findings.groupErrorIntro', locale)}</p> : null}
            {severity === firstOther ? <p>{t('findings.groupOtherIntro', locale)}</p> : null}
            <ul className="m-0 list-none p-0">
              {group.map((finding, index) => {
                const messageId = `${base}-${severity}-${index}`;
                return (
                  <li
                    key={`${finding.ruleId}|${finding.path}`}
                    className={`mb-3 border-l-4 p-3 ${GROUP_STYLE[severity]}`}
                  >
                    <p id={messageId} className="m-0">
                      <strong>
                        <span aria-hidden="true">{SEVERITY_ICON[severity]} </span>
                        {t(`severity.${severity}`, locale)}:
                      </strong>{' '}
                      {finding.message}
                    </p>
                    {finding.acknowledgement ? (
                      <p className="m-0 mt-1">
                        {t('findings.acknowledged', locale, {
                          reason: finding.acknowledgement.reason,
                          date: formatDate(finding.acknowledgement.expiresAt, locale),
                        })}
                      </p>
                    ) : null}
                    <p className="m-0 mt-1">{t('findings.rule', locale, { ruleId: finding.ruleId })}</p>
                    {canGoToField && finding.path !== '' ? (
                      <button
                        type="button"
                        className="button-secondary mt-2"
                        aria-describedby={messageId}
                        onClick={() => onGoToField(finding.path)}
                      >
                        {t('findings.goToField', locale)}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
