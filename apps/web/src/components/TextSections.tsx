/**
 * TextSections — long-form text in headed sections, as numbered steps or paragraphs, for the help and privacy pages.
 *
 * Why: the help page (UD-013) and the privacy notice (DATA-006) are read rather than operated, so they use the body
 *      typeface, 70-character lines and line height 1.5 (UD-002), and steps are a numbered list so their order is
 *      announced. Their text comes from the locale files by key (DOC-009).
 * Spec: UD-002, UD-013, DATA-006
 * Invariants:
 *   - One `h2` per section; the page owns its `h1`.
 * Collaborators: ../app/(portal)/hjelp/page.tsx, ../app/(portal)/personvern/page.tsx, ../i18n/translate.ts.
 * Tests: apps/web/test/components/TextSections.test.tsx
 */
import { t, type Locale, type MessageKey } from '../i18n/translate';

/** One section: its heading and its texts, in order. */
export interface TextSection {
  readonly heading: MessageKey;
  readonly texts: readonly MessageKey[];
  /** `steps` for an ordered list of things to do, `paragraphs` for prose. */
  readonly kind: 'steps' | 'paragraphs';
}

/**
 * Renders the sections.
 * @param props - The sections and the locale.
 * @returns The sections.
 */
export function TextSections({
  sections,
  locale,
}: {
  readonly sections: readonly TextSection[];
  readonly locale: Locale;
}) {
  return (
    <div className="font-body">
      {sections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h2>{t(section.heading, locale)}</h2>
          {section.kind === 'steps' ? (
            <ol className="list-decimal pl-6">
              {section.texts.map((key) => (
                <li key={key} className="mb-1">
                  {t(key, locale)}
                </li>
              ))}
            </ol>
          ) : (
            section.texts.map((key) => (
              <p key={key} className="mb-3">
                {t(key, locale)}
              </p>
            ))
          )}
        </section>
      ))}
    </div>
  );
}
