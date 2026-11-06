/**
 * h5pTextsLibraryChecks — checks `content/h5p-tekstar/` against the installed libraries in `npm run content:check`:
 * every library version is installed, every path and library string exists, and every `en` is still the library's
 * English text.
 *
 * Why: the overlay skips an entry the library no longer matches, so a library update never shows a stale
 *      translation (D-111); this check makes the skip visible before a merge, naming the file, line and key, so ALU
 *      updates the text instead of losing it silently. The server's start-up has no installed library folder to read
 *      and does not run it (as for the pattern skeletons, D-084 amendment).
 * Spec: H5P-008, H5P-010
 * Invariants:
 *   - Reads only through the catalogue (`semanticsOf`, `languageFileOf`); never changes anything.
 *   - A `default` entry needs a field with a text default, a `label` entry a field with a label; the library's text
 *     is compared trimmed, as the overlay compares it.
 *   - A guidance field must be a `video` field, of a library version with no `language/en.json`, whose description
 *     would hide the English guidance in the editor.
 * Collaborators: ./h5pTextsContent.ts (the caller), ./installedLibraries.ts, ./contentSource.ts,
 *   ../../h5p/languageOverlay/semanticsPath.ts.
 * Tests: apps/server/test/learningDesign/content/h5pTextsLibraryChecks.test.ts
 */
import { resolveSemanticsPath } from '../../h5p/languageOverlay/semanticsPath.js';
import type { ContentProblem } from './contentProblem.js';
import { problemAt, type ContentSource } from './contentSource.js';
import type { LibraryTextEntry, LibraryTextsFile, VideoGuidanceFile } from './h5pTextsYaml.js';
import { parseLibraryName, type InstalledLibraryCatalogue } from './installedLibraries.js';

/** The loaded files of `content/h5p-tekstar/`, with their locators. */
export interface H5pTextsSources {
  readonly libraryTexts: readonly ContentSource<LibraryTextsFile>[];
  readonly guidance: ContentSource<VideoGuidanceFile>;
}

/** Whether that version is installed; a library without `semantics.json` (H5P.DragNBar) is still installed. */
const installed = (catalogue: InstalledLibraryCatalogue, library: string): boolean => {
  const name = parseLibraryName(library);
  return catalogue
    .versionsOf(name?.machineName ?? '')
    .some((version) => version.major === name?.major && version.minor === name.minor);
};

const notInstalled = (library: string) =>
  `${library} is not installed; correct the version, or run npm run h5p:fetch-libraries`;
const changed = (english: string) =>
  `is not the library's English text any more, which is now "${english}"; update en and check the translation`;

/** The library's English `libraryStrings`, from `en.json` or H5P's template `.en.json`. */
function englishStringsOf(catalogue: InstalledLibraryCatalogue, library: string): Record<string, unknown> {
  for (const code of ['en', '.en']) {
    const strings = (catalogue.languageFileOf?.(library, code) as { libraryStrings?: unknown } | undefined)
      ?.libraryStrings;
    if (typeof strings === 'object' && strings !== null) return strings as Record<string, unknown>;
  }
  return {};
}

function entryProblems(
  source: ContentSource<LibraryTextsFile>,
  catalogue: InstalledLibraryCatalogue,
  library: string,
): ContentProblem[] {
  if (!installed(catalogue, library))
    return [problemAt(source, ['libraries', library], notInstalled(library))];
  const semantics = catalogue.semanticsOf(library) ?? [];
  const section = source.value.libraries[library] ?? {};
  const problems: ContentProblem[] = [];
  const check = (part: string, key: string, entry: LibraryTextEntry, english: unknown, missing: string) => {
    const at = ['libraries', library, part, key];
    if (typeof english !== 'string') problems.push(problemAt(source, at, missing));
    else if (english.trim() !== entry.en)
      problems.push(problemAt(source, [...at, 'en'], changed(english.trim())));
  };
  for (const [part, property] of [
    ['defaults', 'default'],
    ['labels', 'label'],
  ] as const) {
    for (const [path, entry] of Object.entries(section[part] ?? {})) {
      const field = resolveSemanticsPath(semantics, path)?.field;
      if (!field)
        problems.push(
          problemAt(
            source,
            ['libraries', library, part, path],
            `is not a field of ${library}; check the spelling`,
          ),
        );
      else
        check(
          part,
          path,
          entry,
          field[property],
          `this field of ${library} has no ${property} text to translate`,
        );
    }
  }
  const strings = englishStringsOf(catalogue, library);
  for (const [key, entry] of Object.entries(section.libraryStrings ?? {})) {
    const english = Object.hasOwn(strings, key) ? strings[key] : undefined;
    check('libraryStrings', key, entry, english, `is not a library string of ${library}`);
  }
  return problems;
}

function guidanceProblems(
  source: ContentSource<VideoGuidanceFile>,
  catalogue: InstalledLibraryCatalogue,
): ContentProblem[] {
  return source.value.fields.flatMap(({ library, field }, index): ContentProblem[] => {
    if (!installed(catalogue, library))
      return [problemAt(source, ['fields', index, 'library'], notInstalled(library))];
    const found = resolveSemanticsPath(catalogue.semanticsOf(library) ?? [], field)?.field;
    if (!found) return [problemAt(source, ['fields', index, 'field'], `is not a field of ${library}`)];
    if (found.type !== 'video')
      return [problemAt(source, ['fields', index, 'field'], `is a ${found.type} field, not a video field`)];
    if (catalogue.languageFileOf?.(library, 'en') !== undefined)
      return [
        problemAt(
          source,
          ['fields', index, 'library'],
          `${library} has language/en.json, whose description would hide the English guidance in the editor`,
        ),
      ];
    return [];
  });
}

/**
 * Checks the H5P texts against the installed libraries.
 * @param sources - The loaded library-texts files and the video guidance.
 * @param catalogue - The installed libraries (`npm run h5p:fetch-libraries`).
 * @returns Every problem, each with its file, line and key; empty when all entries match.
 * @spec H5P-008
 */
export function h5pTextsLibraryProblems(
  sources: H5pTextsSources,
  catalogue: InstalledLibraryCatalogue,
): ContentProblem[] {
  return [
    ...sources.libraryTexts.flatMap((source) =>
      Object.keys(source.value.libraries).flatMap((library) => entryProblems(source, catalogue, library)),
    ),
    ...guidanceProblems(sources.guidance, catalogue),
  ];
}
