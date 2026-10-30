/**
 * patternTokenChecks — the checks between a pattern's `pattern.yaml` and its skeletons that need no installed
 * library: every token has a text and every text is used, the titles fit, and guidance inside a blank or a
 * draggable word cannot be misread, in nn, nb and en.
 *
 * Why: a skeleton's texts come from `pattern.yaml` (D-084). A token without a text would reach authors as
 *      `{{name}}`, an unused text is a forgotten edit, Lumi refuses a title over 255 characters, and Blanks and
 *      DragText read `:` inside `*…*` as a tip and `/` as an alternative answer, which would split a guidance
 *      marker `⟦…⟧` (D-084 amendment). Each must stop `content:check` with the file and the key.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - Only own keys of `texts` count: a token named like an object member (`constructor`) has no text.
 *   - Titles, the activity's and each sub-content's `metadata.title`, are one line of at most 255 characters,
 *     measured with `&`, `<` and `>` escaped: the form H5P's editor stores a title in, and the longer of the two.
 *   - Blanks: each `questions` item; DragText: `textField` and `distractors`; in the activity itself or in any
 *     sub-content node. Only the marked guidance inside `*…*` is checked.
 * Collaborators: ./patternFolder.ts (the caller), ./contentSource.ts, ../patterns/skeletonTokens.ts.
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts
 */
import type { ContentProblem } from './contentProblem.js';
import { CONTENT_LANGUAGES } from './contentText.js';
import { problemAt, type ContentSource } from './contentSource.js';
import type { PatternFile } from './patternYaml.js';
import type { SkeletonFile } from './skeletonFile.js';
import {
  escapeTokenValue,
  hasStrayBraces,
  resolveTokens,
  skeletonStrings,
  tokensIn,
  type TokenValues,
} from '../patterns/skeletonTokens.js';
import type { Locale } from '../../i18n/translate.js';

/** Lumi refuses a longer title (its metadata schema). */
export const TITLE_MAX_LENGTH = 255;

type Path = readonly (string | number)[];

/**
 * The texts of a pattern in one language, as token values.
 * @param texts - `pattern.yaml`'s `texts`.
 * @param language - The language.
 * @returns A lookup that knows only the file's own keys.
 */
export const tokenValuesOf =
  (texts: PatternFile['texts'], language: Locale): TokenValues =>
  (name) =>
    Object.hasOwn(texts, name) ? texts[name]?.[language] : undefined;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every node with its library and params: the skeleton itself and each sub-content in it. */
function nodesOf(skeleton: SkeletonFile): { library: string; params: unknown; path: Path; title?: Path }[] {
  const nodes: { library: string; params: unknown; path: Path; title?: Path }[] = [
    { library: skeleton.library, params: skeleton.params, path: ['params'] },
  ];
  const visit = (value: unknown, path: Path): void => {
    if (Array.isArray(value)) return value.forEach((item: unknown, i) => visit(item, [...path, i]));
    if (!isObject(value) || path.length > 100) return;
    if (typeof value.library === 'string' && isObject(value.params)) {
      const hasTitle = isObject(value.metadata) && typeof value.metadata.title === 'string';
      nodes.push({
        library: value.library,
        params: value.params,
        path: [...path, 'params'],
        ...(hasTitle ? { title: [...path, 'metadata', 'title'] } : {}),
      });
    }
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
  };
  visit(skeleton.params, ['params']);
  return nodes;
}

const valueAt = (root: unknown, path: Path): unknown =>
  path.reduce<unknown>((value, key) => (value as Record<string | number, unknown> | undefined)?.[key], root);

function titleProblems(source: ContentSource<SkeletonFile>, path: Path, texts: PatternFile['texts']) {
  const template = valueAt(source.value, path);
  if (typeof template !== 'string') return [];
  const lengths = CONTENT_LANGUAGES.map((language) => {
    const title = resolveTokens(template, tokenValuesOf(texts, language), false);
    return { language, length: escapeTokenValue(title).length, broken: /[\r\n]/.test(title) };
  });
  const tooLong = lengths.filter(({ length }) => length > TITLE_MAX_LENGTH);
  const problems: ContentProblem[] = [];
  if (lengths.some(({ broken }) => broken))
    problems.push(problemAt(source, path, 'is a title and must be one line'));
  if (tooLong.length > 0) {
    const where = tooLong.map(({ language, length }) => `${length} characters in ${language}`).join(', ');
    problems.push(
      problemAt(
        source,
        path,
        `is too long once filled in (${where}, with & < > counted as H5P stores them); ` +
          `a title may have at most ${TITLE_MAX_LENGTH}`,
      ),
    );
  }
  return problems;
}

const GUIDED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'H5P.Blanks': ['questions'],
  'H5P.DragText': ['textField', 'distractors'],
};

function blankProblems(source: ContentSource<SkeletonFile>, texts: PatternFile['texts']): ContentProblem[] {
  const problems: ContentProblem[] = [];
  for (const node of nodesOf(source.value)) {
    const fields = GUIDED_FIELDS[node.library.split(' ')[0] ?? ''] ?? [];
    const strings = fields.flatMap((field) =>
      skeletonStrings((node.params as Record<string, unknown>)[field], [...node.path, field]),
    );
    for (const { path, text } of strings) {
      const misread = CONTENT_LANGUAGES.flatMap((language) => {
        const resolved = resolveTokens(text, tokenValuesOf(texts, language));
        const blanks = [...resolved.matchAll(/\*([^*]*)\*/g)].map((match) => match[1] ?? '');
        const marked = blanks.flatMap((blank) => [...blank.matchAll(/⟦[^⟦⟧]*⟧/g)].map((m) => m[0]));
        return marked
          .filter((guidance) => /[:/]/.test(guidance))
          .map((guidance) => `${language}: «${guidance}»`);
      });
      if (misread.length > 0)
        problems.push(
          problemAt(
            source,
            path,
            `has guidance inside a blank or a draggable word (between * and *) that holds ` +
              `":" or "/", which the content type reads as a tip or another answer (${misread.join('; ')}); ` +
              'write that guidance without them',
          ),
        );
    }
  }
  return problems;
}

/**
 * Checks a pattern's tokens, titles and blank guidance against its skeletons.
 * @param pattern - The loaded pattern.yaml.
 * @param skeletons - Its loaded skeletons.
 * @returns Every problem, each naming its file and key.
 * @spec PED-010
 */
export function patternTokenProblems(
  pattern: ContentSource<PatternFile>,
  skeletons: readonly ContentSource<SkeletonFile>[],
): ContentProblem[] {
  const { texts } = pattern.value;
  const used = new Set<string>();
  const problems: ContentProblem[] = [];
  for (const skeleton of skeletons) {
    for (const { path, text } of skeletonStrings(skeleton.value)) {
      if (hasStrayBraces(text))
        problems.push(problemAt(skeleton, path, 'has a {{ or }} that is not part of a {{token}}'));
      for (const token of tokensIn(text)) {
        used.add(token.name);
        if (!token.valid)
          problems.push(problemAt(skeleton, path, `has {{${token.name}}}, which is not a token name`));
        else if (!Object.hasOwn(texts, token.name))
          problems.push(
            problemAt(
              skeleton,
              path,
              `uses {{${token.name}}}, but pattern.yaml has no text ` + `"${token.name}" under texts`,
            ),
          );
      }
    }
    problems.push(...titleProblems(skeleton, ['metadataTitle'], texts));
    for (const node of nodesOf(skeleton.value))
      if (node.title) problems.push(...titleProblems(skeleton, node.title, texts));
    problems.push(...blankProblems(skeleton, texts));
  }
  for (const name of Object.keys(texts).filter((key) => !used.has(key)))
    problems.push(
      problemAt(
        pattern,
        ['texts', name],
        `is not used by any skeleton; use {{${name}}} in one, ` + 'or remove the text',
      ),
    );
  return problems;
}
