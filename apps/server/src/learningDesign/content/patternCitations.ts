/**
 * patternCitations — the research a pattern's "why it works" cites as `[@key]`: the keys in order, and the checks
 * that each exists in references.yaml and that nn, nb and en cite the same ones.
 *
 * Why: every claim on a pattern's page names its source (PED-010: `whyItWorks` with reference keys), and the page
 *      lists the cited references at the end, as the guide does (PED-002). A citation of an unknown key, or one
 *      language citing other research, must stop `content:check` (D-082: parity of citations).
 * Spec: PED-010, PED-002
 * Invariants:
 *   - A citation is `[@key]` with no space inside; the keys are returned in first-citation order, each once.
 *   - The three languages cite the same keys in the same order; a difference is one problem on the language that
 *     differs from nn.
 *   - Unknown keys are reported with `unresolvedCitationProblems`, at the line and key of that language's text.
 * Collaborators: ./patternFolder.ts (the caller), ./referencesContent.ts, ./contentSource.ts; the guide and catalogue
 *   workstream (W1) reads `citedReferenceKeys`.
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts
 */
import type { ContentProblem } from './contentProblem.js';
import { CONTENT_LANGUAGES, type LocalisedText } from './contentText.js';
import { problemAt, type ContentSource } from './contentSource.js';
import type { PatternFile } from './patternYaml.js';
import { unresolvedCitationProblems, type ReferencesContent } from './referencesContent.js';
import type { Locale } from '../../i18n/translate.js';

const CITATION = /\[@([^\]\s]*)\]/g;

const keysIn = (text: string): string[] => [...text.matchAll(CITATION)].map((match) => match[1] ?? '');

/**
 * The reference keys a "why it works" text cites, in the order of their first citation.
 * @param whyItWorks - The text in nn, nb and en (the languages cite the same keys once loaded).
 * @param language - Which language to read; nn by default.
 * @returns Each key once.
 * @spec PED-010
 */
export function citedReferenceKeys(whyItWorks: LocalisedText, language: Locale = 'nn'): string[] {
  return [...new Set(keysIn(whyItWorks[language]))];
}

/**
 * Checks a pattern's citations.
 * @param pattern - The loaded pattern.yaml.
 * @param references - The loaded references, or undefined when references.yaml failed (already reported).
 * @returns Every problem, each naming the file and the line of the language's text.
 * @spec PED-010
 */
export function patternCitationProblems(
  pattern: ContentSource<PatternFile>,
  references: ReferencesContent | undefined,
): ContentProblem[] {
  const { whyItWorks } = pattern.value;
  const reference = keysIn(whyItWorks.nn).join(', ');
  const problems: ContentProblem[] = [];
  for (const language of CONTENT_LANGUAGES) {
    const path = ['whyItWorks', language];
    const keys = keysIn(whyItWorks[language]);
    if (language !== 'nn' && keys.join(', ') !== reference) {
      const cited = keys.length > 0 ? keys.map((key) => `[@${key}]`).join(' ') : 'nothing';
      problems.push(
        problemAt(
          pattern,
          path,
          `cites ${cited}, but nn cites ` +
            `${
              reference === ''
                ? 'nothing'
                : keysIn(whyItWorks.nn)
                    .map((key) => `[@${key}]`)
                    .join(' ')
            }; ` +
            'the three languages cite the same references in the same order',
        ),
      );
    }
    const { line, key: keyPath } = pattern.locate(path);
    // WHY: a key nn cites is reported once, at nn's line; another language adds only the keys nn lacks.
    const own = language === 'nn' ? keys : keys.filter((key) => !keysIn(whyItWorks.nn).includes(key));
    const citations = [...new Set(own)].map((key) => ({ key, ...(line === undefined ? {} : { line }) }));
    // WHY: the shared check names the file and the line; the key path (`whyItWorks.nb`) is added for ALU (D-082).
    problems.push(
      ...unresolvedCitationProblems(references, pattern.file, citations).map((problem) =>
        keyPath === undefined ? problem : { ...problem, key: keyPath },
      ),
    );
  }
  return problems;
}
