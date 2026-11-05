/**
 * authoredLanguage — the `lang` of the texts the Innsikt tab quotes from the activity: question, option, feedback and
 * accepted-answer texts, the video's task names, and the wrong gap answers learners gave in the activity.
 *
 * Why: WCAG 3.1.2 Language of Parts and UD-010: the page language follows the UI locale, but these texts come from the
 *      activity's parameters, in the activity's own language. Under a Nynorsk page an English question would otherwise
 *      be read with a Nynorsk voice. The tab is given the activity's language once, and each part reads it here.
 * Spec: UD-010, INS-002, INS-003, INS-005
 * Invariants:
 *   - The value is `partLanguage(activity language, page locale)`: undefined when the activity is in the page's
 *     language or states none, so no attribute is written then.
 *   - Only the quoted text itself carries it; a UI fallback («Spørsmål 3 (utan tekst)», «Inga tilbakemelding») or a
 *     localised sentence around a text never does.
 *   - A11Y: a known limit: a sentence the tab builds around a quoted text (a chart summary, a table caption, a
 *     shortlist line, an announcement) is one string in the page's language, so its quoted part is not marked.
 * Collaborators: ../../i18n/partLanguage.ts, ./InsightPanel.tsx, the sections and the shortlist in this folder.
 * Tests: apps/web/test/features/insight/InsightLanguage.test.tsx
 */
'use client';

import { createContext, useContext } from 'react';

/** The `lang` of the activity's texts on the tab; undefined when they are in the page's language. */
export const AuthoredLanguageContext = createContext<string | undefined>(undefined);

/**
 * The `lang` for a text quoted from the activity.
 * @returns The activity's language tag when it differs from the page's, else undefined.
 */
export const useAuthoredLang = (): string | undefined => useContext(AuthoredLanguageContext);
