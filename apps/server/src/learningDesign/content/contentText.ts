/**
 * contentText — the zod schemas for texts in `content/`: one text, and one text in each of the three UI languages.
 *
 * Why: every text the studio shows exists in Nynorsk, Bokmål and English (PED-001, PROD-012, D-082). A missing
 *      language must stop the start and say which language of which key is missing, in words ALU can act on.
 * Spec: PED-001, PROD-012
 * Invariants:
 *   - A localised text has exactly the keys `nn`, `nb` and `en`; a missing one is named, another key is refused.
 *   - A text is trimmed, never blank, at most `maxLength` characters, and holds no control characters; a one-line
 *     text holds no line break either (YAML's `>-` folds a long line into one).
 *   - The output matches `LocaleText` in `@hvl-interaktiv/api-contract`, so routes pass it through unchanged.
 * Collaborators: ./phasesContent.ts, ./referencesContent.ts, ./patternYaml.ts, ./mappeCriteriaFile.ts and the other
 *   content section loaders; ../../i18n/translate.ts (`LOCALES`).
 * Tests: apps/server/test/learningDesign/content/contentText.test.ts
 */
import { z } from 'zod';
import { LOCALES, type Locale } from '../../i18n/translate.js';

/** The languages every content text needs, in the order editors write them. */
export const CONTENT_LANGUAGES = LOCALES;

/** A text in Nynorsk, Bokmål and English. */
export type LocalisedText = Readonly<Record<Locale, string>>;

/** The limits of one text. */
export interface ContentTextLimits {
  /** The longest text allowed, in characters, after trimming. */
  readonly maxLength: number;
  /** False lets the text hold line breaks (e.g. a paragraph written with `|`); one line by default. */
  readonly singleLine?: boolean;
}

// WHY: a tab or newline is the only control character an editor types on purpose; anything else is a paste error
// that would show up as an odd box on the page.
const CONTROL = /[\p{Cc}]/u;
const LINE_BREAK = /[\r\n]/;

const typedText = (missing: string) =>
  z.string({
    error: (issue) =>
      issue.input === undefined ? missing : issue.input === null ? 'is empty' : 'must be text',
  });

const limited = (text: ReturnType<typeof typedText>, { maxLength, singleLine = true }: ContentTextLimits) =>
  text
    .trim()
    .min(1, 'is empty')
    .max(maxLength, `is longer than ${maxLength} characters`)
    .refine((value) => !singleLine || !LINE_BREAK.test(value), 'must be one line')
    .refine((value) => !CONTROL.test(value.replace(/[\t\r\n]/g, '')), 'holds a control character');

/**
 * One text, such as a reference.
 * @param limits - Its length limit and whether it is one line.
 * @returns A schema giving the trimmed text.
 */
export const contentText = (limits: ContentTextLimits) => limited(typedText('is missing'), limits);

/**
 * One text in `nn`, `nb` and `en`, such as a phase label.
 * @param limits - The limits every language's text keeps.
 * @returns A strict schema of `{ nn, nb, en }` that names a missing language.
 * @example localisedContentText({ maxLength: 60 }).parse({ nn: 'Forarbeid', nb: 'Forarbeid', en: 'Pre-work' })
 */
export const localisedContentText = (limits: ContentTextLimits) => {
  const language = (code: Locale) =>
    limited(typedText(`the ${code} text is missing (every text needs nn, nb and en)`), limits);
  return z.strictObject(
    { nn: language('nn'), nb: language('nb'), en: language('en') },
    {
      error: (issue) =>
        issue.code === 'invalid_type' && issue.input != null
          ? 'must give the text in nn, nb and en, each on its own line below the key'
          : undefined,
    },
  );
};
