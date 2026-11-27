/**
 * quotedText — a sentence of the Innsikt tab that quotes one text from the activity, with the place of that text in
 * it, and the component that writes the sentence with only the quoted part in the activity's language.
 *
 * Why: WCAG 3.1.2 Language of Parts and UD-010: a chart summary, a table caption, a shortlist line, the list's title
 *      and an announcement are sentences in the page's language that quote a question, an option, feedback, a typed
 *      answer, a video task or the activity's title in the activity's own language. The sentence stays one string for
 *      every string consumer (tests, keys, `aria-*`), and its quoted range lets the tab mark just that part.
 * Spec: UD-010, INS-002, INS-003, INS-005, INS-008
 * Invariants:
 *   - `text` is exactly what `t(key, locale, params)` returns.
 *   - The range is found by the placeholder's place in the message, never by searching for the value, so a value that
 *     also occurs elsewhere in the sentence (an option «1» in «Luke 1») is marked where it is quoted.
 *   - A sentence that quotes only a UI fallback («Spørsmål 3 (utan tekst)», «Oppgåve utan tittel») has no range.
 *   - No `lang` and no span when the activity is in the page's language (./authoredLanguage.tsx).
 * Collaborators: ./authoredLanguage.tsx, ../../i18n/translate.ts, ./insightSummaries.ts, ./shortlistEntries.ts,
 *   ./shortlistContext.tsx, ./useQuotedAnnouncement.tsx, the sections and the shortlist in this folder.
 * Tests: apps/web/test/features/insight/quotedText.test.tsx,
 *   apps/web/test/features/insight/InsightQuotedLanguage.test.tsx
 */
'use client';

import { t, type Locale, type MessageKey } from '../../i18n/translate';
import { useAuthoredLang } from './authoredLanguage';

/** A finished sentence in the page's language, and the place in it of the one text it quotes from the activity. */
export interface QuotedText {
  readonly text: string;
  /** `[start, end)` of the quoted text in `text`; absent when it quotes none or only a UI fallback. */
  readonly quoted?: readonly [start: number, end: number];
}

/**
 * A sentence that quotes nothing from the activity.
 * @param text - The sentence.
 * @returns It, without a quoted range.
 */
export const plainText = (text: string): QuotedText => ({ text });

/**
 * Builds a sentence with `t()` and, when `authored` names one of its params, the range of that param's value in it.
 * @param key - The message.
 * @param locale - The page locale.
 * @param params - The message's params.
 * @param authored - The param that holds the activity's own text; omit when the sentence quotes none or a fallback.
 * @returns The sentence and, for an authored param, its range.
 * @example quotedSentence('insight.choice.summary', 'nn', { option: 'A', count: '3' }, 'option')
 * @spec UD-010
 */
export function quotedSentence(
  key: MessageKey,
  locale: Locale,
  params: Record<string, string | number>,
  authored?: string,
): QuotedText {
  const text = t(key, locale, params);
  if (authored === undefined || !(authored in params)) return { text };
  // WHY: by position, not by search: t() leaves an unknown `{{name}}` visible, so the message without that one param
  // shows where the value goes, even when the same text also stands elsewhere in the sentence.
  const { [authored]: value, ...others } = params;
  const placeholder = `{{${authored}}}`;
  const skeleton = t(key, locale, others);
  const start = skeleton.indexOf(placeholder);
  if (start < 0) return { text };
  const quotedText = String(value);
  const spliced = skeleton.slice(0, start) + quotedText + skeleton.slice(start + placeholder.length);
  // WHY: a message with the placeholder twice, or a value holding `{{…}}`, would not splice to t()'s text; the
  // sentence then stays unmarked rather than marking the wrong part.
  if (spliced !== text) return { text };
  return { text, quoted: [start, start + quotedText.length] };
}

/**
 * Writes a sentence, with its quoted part in the activity's language.
 * @param props - The sentence.
 * @returns The text; the quoted part in `<span lang>` when the activity's language differs from the page's.
 */
export function Quoted({ value }: { readonly value: QuotedText }) {
  const lang = useAuthoredLang();
  if (!value.quoted || !lang || value.quoted[0] === value.quoted[1]) return <>{value.text}</>;
  const [start, end] = value.quoted;
  // A11Y: WCAG 3.1.2: only the quoted text is read in the activity's language; the words around it stay the page's.
  return (
    <>
      {value.text.slice(0, start)}
      <span lang={lang}>{value.text.slice(start, end)}</span>
      {value.text.slice(end)}
    </>
  );
}
