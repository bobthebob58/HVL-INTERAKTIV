/**
 * insightContextLabels — the names of the contexts an activity's insight can be shown for: «Portalen (spelt utanom
 * Canvas)», or a Canvas course by its course label, numbered when two courses share a label.
 *
 * Why: on the activity page the owner or co-author picks one of the activity's contexts, labelled with the course
 *      label the launch gave (D-106, D-087); a context is one course of one Canvas (D-103), so two of HVL's Canvas
 *      instances can have courses with the same label, and each option must still be told apart (WCAG 2.4.6).
 * Spec: INS-007, LTI-006
 * Invariants:
 *   - The portal is `PORTAL_CONTEXT` (`portal`, equal to the contract's `PORTAL_CONTEXT_KEY`, which a test checks);
 *     every other key is a course. Only types come from the contract, so zod stays out of the browser bundle.
 *   - Options keep the server's order (the portal first); a label shared by several courses gets «(nr. n)» in that
 *     order; a course without a label is «Canvas-emne utan emnekode», numbered the same way.
 * Collaborators: @hvl-interaktiv/api-contract (`InsightContext`), ./InsightQueryForm.tsx, ./InsightPanel.tsx.
 * Tests: apps/web/test/features/insight/insightLabels.test.ts
 */
import type { InsightContext } from '@hvl-interaktiv/api-contract';
import { t, type Locale } from '../../i18n/translate';

/** The context key of the portal's plays (the contract's `PORTAL_CONTEXT_KEY`). */
export const PORTAL_CONTEXT = 'portal';

/** A context as the selector offers it. */
export interface ContextOption {
  readonly key: string;
  readonly label: string;
}

/**
 * The name of one context, without numbering.
 * @param context - The context.
 * @param locale - The page locale.
 * @returns «Portalen (spelt utanom Canvas)», «SYK110 i Canvas» or «Canvas-emne utan emnekode».
 */
export function contextName(context: InsightContext, locale: Locale): string {
  if (context.key === PORTAL_CONTEXT) return t('insight.query.contextPortal', locale);
  if (context.label === null) return t('insight.query.contextUnlabelled', locale);
  return t('insight.query.contextCourse', locale, { label: context.label });
}

/**
 * The options of the context selector, each name unique.
 * @param contexts - The server's list, portal first.
 * @param locale - The page locale.
 * @returns One option per context, in the same order.
 * @spec INS-007
 */
export function contextOptions(contexts: readonly InsightContext[], locale: Locale): ContextOption[] {
  const names = contexts.map((context) => contextName(context, locale));
  const totals = new Map<string, number>();
  for (const name of names) totals.set(name, (totals.get(name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return contexts.map((context, index) => {
    const name = names[index] ?? '';
    if ((totals.get(name) ?? 0) < 2) return { key: context.key, label: name };
    const number = (seen.get(name) ?? 0) + 1;
    seen.set(name, number);
    return { key: context.key, label: t('insight.query.contextNumbered', locale, { label: name, number }) };
  });
}
